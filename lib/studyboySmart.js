// Server-side engine for Smart Study — the adaptive, one-question-at-a-time
// session. Two calls:
//   generateQuestions: a batch of varied questions, grounded in the student's
//     own notes, steered towards weak topics, never repeating what was asked.
//   gradeAnswer: marks a typed answer and, on a first miss, replies with a
//     guiding QUESTION rather than the answer (Socratic).
// Both return { status, body } like generateStudyMaterial. Uses ANTHROPIC_API_KEY.

import crypto from 'crypto';
import { STRICTNESS, DIFFICULTY } from './studyboyGenerate.js';

const MODEL = 'claude-sonnet-4-5-20250929';
const MAX_SOURCE_CHARS = 60000;
const MAX_ASKED_SENT = 40;
export const BATCH_SIZE = 5;

// The system prompt is identical on every call so the source material block can
// be prompt-cached: a session makes many calls against the same notes.
const NEXT_SYSTEM = `You run an adaptive, Socratic study session for a secondary student in NSW, Australia. You write the next batch of questions, grounded in the student's own source material.

Question formats — mix them across the batch, do not use one format for everything:
- "mc": multiple choice. 4 options, exactly one correct. Distractors reflect real misconceptions, not obviously wrong filler.
- "tf": a single true/false statement. A statement that is subtly false is more useful than an obviously false one.
- "short": answered in one to three sentences. Give a model_answer and key_points (2-4 short phrases a correct answer must contain).
- "fill": one sentence with a single blank written as ____. The answer is the missing word or short phrase; add accept_also for valid alternatives.

Every question also has:
- topic: a short label taken from the material.
- hint: a guiding QUESTION that nudges the student towards the answer WITHOUT stating it.
- explanation: one or two sentences on why the correct answer is right.

Rules:
- Never repeat, reword or closely mirror a question listed under "Already asked".
- Cover different topics across the batch rather than clustering.
- When "Focus topics" are given, make about half the batch about those topics.
- Follow the stated difficulty and the stay-in-the-notes rule.

Respond with ONLY a JSON object, no markdown fences:
{ "questions": [
  { "kind": "mc", "topic": "...", "question": "...", "options": ["A","B","C","D"], "correct_index": 0, "hint": "...", "explanation": "..." },
  { "kind": "tf", "topic": "...", "question": "statement", "answer": true, "hint": "...", "explanation": "..." },
  { "kind": "short", "topic": "...", "question": "...", "model_answer": "...", "key_points": ["..."], "hint": "...", "explanation": "..." },
  { "kind": "fill", "topic": "...", "question": "sentence with ____", "answer": "...", "accept_also": ["..."], "hint": "...", "explanation": "..." }
] }`;

const GRADE_SYSTEM = `You mark one written answer in a Socratic study session. Judge ONLY against the model answer and key points, which come from the student's own notes. Accept different wording and minor spelling slips when the meaning is right.

Respond with ONLY a JSON object, no markdown fences:
{ "verdict": "correct" | "partial" | "incorrect", "feedback": "one short sentence", "guiding_question": "..." }

Rules:
- attempt 1 and verdict is not "correct": give a guiding_question that leads the student towards the missing idea WITHOUT stating it, and make feedback encouraging and free of the answer.
- attempt 2: no guiding_question. feedback may now say what a correct answer needed.
- verdict "correct" needs every key point covered in the student's own words; "partial" means some but not all.`;

// ---------------------------------------------------------------- helpers

function words(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function normKey(s) {
  return words(s).join(' ');
}

/** True when two questions are the same or near-identical. */
export function similar(a, b) {
  const ka = normKey(a);
  const kb = normKey(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  const A = new Set(words(a));
  const B = new Set(words(b));
  let shared = 0;
  for (const w of A) if (B.has(w)) shared += 1;
  const jaccard = shared / (A.size + B.size - shared);
  return jaccard >= 0.8;
}

export function questionId(text) {
  return crypto.createHash('sha1').update(normKey(text)).digest('hex').slice(0, 10);
}

function str(v, fallback = '') {
  return typeof v === 'string' ? v.trim() : fallback;
}

/**
 * Validates what the model returned, drops malformed questions and anything
 * already asked (or repeated inside the batch), and normalises the shapes.
 * True/false becomes a two-option choice so the UI has one choice path.
 */
export function normaliseQuestions(raw, asked = []) {
  const list = Array.isArray(raw) ? raw : [];
  const seen = [...asked];
  const out = [];

  for (const q of list) {
    if (!q || typeof q !== 'object') continue;
    const question = str(q.question);
    if (!question) continue;
    if (seen.some((s) => similar(s, question))) continue;

    const base = {
      id: questionId(question),
      topic: str(q.topic, 'General') || 'General',
      question,
      hint: str(q.hint),
      explanation: str(q.explanation),
    };

    let built = null;
    if (q.kind === 'mc') {
      const options = Array.isArray(q.options) ? q.options.map((o) => str(String(o ?? ''))) : [];
      const ci = q.correct_index;
      if (options.length === 4 && options.every(Boolean) && Number.isInteger(ci) && ci >= 0 && ci < 4) {
        built = { ...base, kind: 'mc', options, correct_index: ci };
      }
    } else if (q.kind === 'tf') {
      if (typeof q.answer === 'boolean') {
        built = { ...base, kind: 'tf', options: ['True', 'False'], correct_index: q.answer ? 0 : 1 };
      }
    } else if (q.kind === 'short') {
      const model = str(q.model_answer);
      const kp = (Array.isArray(q.key_points) ? q.key_points : []).map((k) => str(String(k ?? ''))).filter(Boolean);
      if (model) built = { ...base, kind: 'short', model_answer: model, key_points: kp };
    } else if (q.kind === 'fill') {
      const answer = str(q.answer);
      if (answer && /_{2,}/.test(question)) {
        const alt = (Array.isArray(q.accept_also) ? q.accept_also : []).map((k) => str(String(k ?? ''))).filter(Boolean);
        built = { ...base, kind: 'fill', answer, accept_also: alt };
      }
    }

    if (built) {
      out.push(built);
      seen.push(question);
    }
  }
  return out;
}

export function parseJson(text) {
  const cleaned = String(text || '').replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const a = cleaned.indexOf('{');
    const b = cleaned.lastIndexOf('}');
    if (a !== -1 && b > a) {
      try {
        return JSON.parse(cleaned.slice(a, b + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function callClaude({ system, content, maxTokens }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      error: { status: 500, body: { error: 'ANTHROPIC_API_KEY is not set. Add it as an environment variable in Render.' } },
    };
  }
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content }],
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) {
      const detail = await response.text();
      return { error: { status: 502, body: { error: 'Claude API error', detail } } };
    }
    const data = await response.json();
    const text = (data.content || [])
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('')
      .trim();
    return { text };
  } catch (err) {
    return { error: { status: 500, body: { error: err.message } } };
  }
}

// ---------------------------------------------------------------- next batch

export async function generateQuestions({
  subject,
  sourceText,
  asked = [],
  focusTopics = [],
  level = 'match',
  strictness = 'strict',
  count = BATCH_SIZE,
}) {
  if (!sourceText || sourceText.trim().length < 50) {
    return { status: 400, body: { error: 'Add some source material first — notes, a syllabus, or a past paper.' } };
  }

  const askedList = (Array.isArray(asked) ? asked : [])
    .filter((a) => typeof a === 'string')
    .slice(-MAX_ASKED_SENT);
  const focus = (Array.isArray(focusTopics) ? focusTopics : []).filter((t) => typeof t === 'string').slice(0, 6);
  const n = Math.min(8, Math.max(1, Number(count) || BATCH_SIZE));

  const content = [
    {
      type: 'text',
      text: `Subject: ${subject || 'Unspecified'}\n\n--- SOURCE MATERIAL ---\n${String(sourceText).slice(0, MAX_SOURCE_CHARS)}`,
      cache_control: { type: 'ephemeral' },
    },
    {
      type: 'text',
      text: [
        `Write ${n} new questions.`,
        STRICTNESS[strictness] || STRICTNESS.strict,
        DIFFICULTY[level] || DIFFICULTY.match,
        focus.length ? `Focus topics: ${focus.join(', ')}` : 'Focus topics: none — cover the material evenly.',
        askedList.length ? `Already asked:\n${askedList.map((q) => `- ${q}`).join('\n')}` : 'Already asked: nothing yet.',
      ].join('\n\n'),
    },
  ];

  const res = await callClaude({ system: NEXT_SYSTEM, content, maxTokens: 3500 });
  if (res.error) return res.error;

  const parsed = parseJson(res.text);
  if (!parsed) return { status: 502, body: { error: "Couldn't parse the questions.", raw: res.text } };

  const questions = normaliseQuestions(parsed.questions, askedList);
  if (questions.length === 0) {
    return { status: 502, body: { error: 'No usable questions came back. Try again.' } };
  }
  return { status: 200, body: { questions } };
}

// ---------------------------------------------------------------- grading

export async function gradeAnswer({
  subject,
  question,
  kind,
  modelAnswer,
  keyPoints = [],
  studentAnswer,
  attempt = 1,
}) {
  if (!question || !studentAnswer || !String(studentAnswer).trim()) {
    return { status: 400, body: { error: 'Nothing to mark.' } };
  }
  const second = Number(attempt) >= 2;
  const content = [
    {
      type: 'text',
      text: [
        `Subject: ${subject || 'Unspecified'}`,
        `Question (${kind || 'short'}): ${question}`,
        `Model answer: ${modelAnswer || '(none given)'}`,
        keyPoints.length ? `Key points:\n${keyPoints.map((k) => `- ${k}`).join('\n')}` : '',
        `Attempt: ${second ? 2 : 1}`,
        `Student's answer: ${String(studentAnswer).slice(0, 2000)}`,
      ]
        .filter(Boolean)
        .join('\n'),
    },
  ];

  const res = await callClaude({ system: GRADE_SYSTEM, content, maxTokens: 400 });
  if (res.error) return res.error;

  const parsed = parseJson(res.text);
  const verdict = ['correct', 'partial', 'incorrect'].includes(parsed?.verdict) ? parsed.verdict : null;
  if (!verdict) return { status: 502, body: { error: "Couldn't mark that answer.", raw: res.text } };

  return {
    status: 200,
    body: {
      verdict,
      feedback: str(parsed.feedback),
      // Only ever a question, and only on a first miss.
      guiding_question: !second && verdict !== 'correct' ? str(parsed.guiding_question) : '',
    },
  };
}
