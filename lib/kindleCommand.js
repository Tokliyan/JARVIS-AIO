// Server-side helpers for /api/kindle/command — the typed-command channel from
// the Kindle. Nothing here runs in the browser. Pure helpers (auth, doc
// numbering, formatting) are kept free of I/O so they can be tested directly;
// the two functions that talk to Claude and Supabase are at the bottom.

import crypto from 'crypto';
import { SUBJECTS } from './subjects.js';

// Single-user app: the same constant the e-ink routes already use.
export const OWNER_ID = '04b4fa14-b541-4b23-92d6-886d6202d727';

export const MAX_COMMAND_CHARS = 500;
export const MAX_DOC_CHARS = 60000;

// ---------------------------------------------------------------- auth

export function extractToken(req) {
  const auth = req.headers?.authorization || '';
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  return (req.headers?.['x-kindle-token'] || '').toString().trim();
}

// Constant-time compare. Hash both sides first so the buffers are always the
// same length (timingSafeEqual throws on a length mismatch).
export function tokenOk(provided, expected) {
  if (!provided || !expected) return false;
  const a = crypto.createHash('sha256').update(String(provided)).digest();
  const b = crypto.createHash('sha256').update(String(expected)).digest();
  return crypto.timingSafeEqual(a, b);
}

// Small in-memory limiter. Render runs one instance, so this is enough to stop
// a leaked token being used to run up the Anthropic bill in a loop.
const hits = [];
export function rateLimited(limit = 20, windowMs = 60_000, now = Date.now()) {
  while (hits.length && now - hits[0] > windowMs) hits.shift();
  if (hits.length >= limit) return true;
  hits.push(now);
  return false;
}
export function _resetRateLimit() {
  hits.length = 0;
}

// ---------------------------------------------------------------- time

// "Today" for the student is Sydney's today, not the server's (UTC).
export function sydneyNow(now = new Date()) {
  const iso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney' }).format(now);
  const dow = new Date(`${iso}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return { iso, dow };
}

export function addDaysISO(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const suffix = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')}${suffix}`;
}

// ---------------------------------------------------------------- subjects

const SUBJECT_HINTS = [
  [/chem|bio|phys|science/i, 'Science'],
  [/math/i, 'Mathematics Advanced'],
  [/english/i, 'English'],
  [/french/i, 'French'],
  [/commerce/i, 'Commerce'],
  [/history/i, 'History'],
  [/relig|\bre\b/i, 'Religious Education'],
  [/pdhpe|\bpe\b|health/i, 'PDHPE'],
];

// Saved docs have a free-text subject ("Maths Ext"), so match leniently.
export function canonSubject(raw) {
  if (!raw) return null;
  const exact = SUBJECTS.find((s) => s.toLowerCase() === String(raw).toLowerCase());
  if (exact) return exact;
  for (const [re, subject] of SUBJECT_HINTS) if (re.test(raw)) return subject;
  return null;
}

// ---------------------------------------------------------------- doc library

// "Doc 3" is the third doc ever saved. Once the pending SQL has run the number
// comes from the doc_number column and stays stable if an earlier doc is
// deleted; until then it falls back to upload order.
export function numberDocs(rows) {
  const sorted = [...(rows || [])].sort(
    (a, b) => new Date(a.uploaded_at || 0) - new Date(b.uploaded_at || 0),
  );
  return sorted.map((d, i) => ({ ...d, n: d.doc_number ?? i + 1 }));
}

export function findDocs(numbered, { doc_number, subject, query } = {}) {
  if (doc_number != null && doc_number !== '') {
    const hit = numbered.find((d) => d.n === Number(doc_number));
    return hit ? [hit] : [];
  }
  let list = numbered;
  const want = canonSubject(subject);
  if (want) list = list.filter((d) => canonSubject(d.subject) === want);
  if (query) {
    const q = String(query).toLowerCase();
    const named = list.filter((d) => (d.file_name || '').toLowerCase().includes(q));
    if (named.length) list = named;
  }
  // Newest first, so "the chem notes" with one clear winner is the latest.
  return [...list].sort((a, b) => new Date(b.uploaded_at || 0) - new Date(a.uploaded_at || 0));
}

export function describeDoc(d) {
  const when = d.uploaded_at
    ? new Date(d.uploaded_at).toLocaleDateString('en-AU', {
        day: 'numeric',
        month: 'short',
        timeZone: 'Australia/Sydney',
      })
    : '';
  return `Doc ${d.n} · ${d.subject || 'No subject'} · ${d.file_name || 'Untitled'}${when ? ` · ${when}` : ''}`;
}

export function formatDocList(docs, heading) {
  if (!docs.length) return `${heading}\n\nNothing saved yet.`;
  return `${heading}\n\n${docs.map(describeDoc).join('\n')}\n\nType "open doc N" to read one.`;
}

// ---------------------------------------------------------------- text for e-ink

// The Kindle shows plain text, so strip the markdown the generators return.
export function mdToPlain(md = '') {
  return String(md)
    .replace(/```[a-z]*\n?/gi, '')
    .replace(/^[ \t]*\|?[ \t]*:?-{2,}:?[ \t]*(\|[ \t]*:?-{2,}:?[ \t]*)*\|?[ \t]*$/gm, '') // table rules
    .replace(/^[ \t]*\|(.+)\|[ \t]*$/gm, (_, row) =>
      row
        .split('|')
        .map((c) => c.trim())
        .join('  |  '),
    )
    .replace(/^#{1,6}\s*(.+)$/gm, (_, h) => `\n${h.toUpperCase()}`)
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1$2')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function formatOutput(payload) {
  if (!payload) return 'Nothing to show.';
  if (payload.text) return mdToPlain(payload.text);

  if (payload.questions) {
    const qs = payload.questions
      .map((q, i) => {
        const opts = (q.options || []).map((o, j) => `   ${'ABCD'[j] || j + 1}) ${o}`).join('\n');
        return `${i + 1}. ${q.question}\n${opts}`;
      })
      .join('\n\n');
    const answers = payload.questions
      .map((q, i) => `${i + 1}. ${'ABCD'[q.correct_index] || '?'} — ${q.explanation || ''}`)
      .join('\n');
    return `QUESTIONS\n\n${qs}\n\n\nANSWERS\n\n${answers}`;
  }

  if (payload.cards) {
    const fronts = payload.cards.map((c, i) => `${i + 1}. ${c.front}`).join('\n');
    const backs = payload.cards.map((c, i) => `${i + 1}. ${c.back}`).join('\n\n');
    return `CARDS — try to answer before you scroll\n\n${fronts}\n\n\nANSWERS\n\n${backs}`;
  }

  if (payload.steps) {
    return payload.steps.map((s) => `${s.date}  ${s.title}\n   ${s.detail || ''}`.trimEnd()).join('\n\n');
  }

  return 'Nothing to show.';
}

// ---------------------------------------------------------------- intent (Claude)

const MODES = ['past_paper', 'study_guide', 'flashcards', 'quiz', 'study_plan'];

export const INTENT_PROMPT = `You turn one short command, typed on a Kindle, into one JSON action for a student's study dashboard.

Respond with ONLY a JSON object. No markdown fences, no preamble.

Subjects (fixed list): ${SUBJECTS.join(', ')}.
Map informal names onto it: Chemistry/Biology/Physics/Chem/Bio/Phys = Science; Maths/Math = Mathematics Advanced; RE = Religious Education; PE = PDHPE.

Actions:
- open_doc: { "action": "open_doc", "doc_number": number or null, "subject": subject or null, "query": string or null }
- list_docs: { "action": "list_docs", "subject": subject or null }
- generate: { "action": "generate", "mode": "past_paper"|"study_guide"|"flashcards"|"quiz"|"study_plan", "subject": subject or null, "doc_number": number or null, "notes": string or null, "assessment_date": "YYYY-MM-DD" or null, "add_plan_to_checklist": boolean }
- last_output: { "action": "last_output", "subject": subject or null, "mode": the five modes above or null }
- summary: { "action": "summary", "scope": "today"|"tomorrow" }
- add_task: { "action": "add_task", "title": string, "due_date": "YYYY-MM-DD" or null, "tag": string }
- help: { "action": "help" }
- unknown: { "action": "unknown", "reason": string }

Rules:
- A doc number comes from phrases like "doc 3", "document 3", "#3". If both a number and a subject are given, keep both; the number wins.
- "pull up / open / show / read" a doc or notes = open_doc. "what docs / list my notes" = list_docs.
- "make / generate / quiz me / flashcards / practice paper / study guide / study plan" = generate. Put any steer ("focus on titration") in notes.
- "show my last quiz / reopen the chem flashcards" = last_output.
- "what's on today / tomorrow / due today" = summary.
- add_task tag is one of: School, Rade.XT, RuneHaven, LeadLens, Ambient Intelligence, General. Use "School · <Subject>" for schoolwork.
- Only set add_plan_to_checklist true if they explicitly ask for the plan to go into their checklist/tasks.
- Resolve relative dates ("Friday", "the 29th") against today's date, which is given in the user message. Use null when no date is stated.
- Anything that edits or deletes existing material is not supported yet: answer with unknown and a short reason.`;

export async function parseKindleIntent(text, todayISO, weekday) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { error: 'ANTHROPIC_API_KEY is not set. Add it as an environment variable in Render.' };
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
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 400,
        system: INTENT_PROMPT,
        messages: [
          { role: 'user', content: `Today is ${weekday} ${todayISO}. Command: ${text}` },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) return { error: `Claude API error (${response.status})` };
    const data = await response.json();
    const raw = (data.content || [])
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('')
      .replace(/```json|```/g, '')
      .trim();
    try {
      return { intent: JSON.parse(raw) };
    } catch {
      return { error: "Couldn't understand that command." };
    }
  } catch (err) {
    return { error: err.message };
  }
}

export { MODES };
