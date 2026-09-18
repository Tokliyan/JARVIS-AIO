// Server-side only. Uses ANTHROPIC_API_KEY, never exposed to the browser.
// Everything generated here is grounded in `sourceText` — the user's own material —
// rather than the model's general knowledge.

const NESA_CONTEXT = `You are writing for a NSW (Australia) secondary student working under the NESA syllabus.

Use NESA exam conventions:
- Use official NESA directive verbs precisely: identify, outline, describe, explain, analyse, evaluate, assess, justify, compare, contrast, discuss, calculate, demonstrate, propose.
- Mark allocation should follow NESA norms: 1 mark per distinct required point. 1-2 marks for identify/outline, 3-4 for describe/explain, 5-8 for analyse/evaluate/assess.
- Marking guidance must be written as criteria ("awards 1 mark for..."), matching how NESA marking guidelines read — not just a model answer.
- Extended response questions should state the number of marks and give an indicative line allocation.`;

const STRICTNESS = {
  strict: `CRITICAL: Stay strictly inside the source material. Do not introduce any concept, term, formula, or example that does not appear in it. If the material is thin on a topic, ask fewer questions rather than inventing content.`,
  extend: `Stay anchored to the source material's topics and difficulty, but you may include closely adjacent content a teacher would reasonably examine alongside it.`,
};

const DIFFICULTY = {
  easier: 'Pitch slightly below the source material — recall and comprehension focused, building confidence.',
  match: 'Match the difficulty of the source material exactly.',
  harder: 'Pitch above the source material — more application, multi-step reasoning, and synthesis across topics.',
};

const PROMPTS = {
  past_paper: `You generate practice assessment papers grounded STRICTLY in the student's own source material.

${NESA_CONTEXT}

Structure the paper properly:
- A header with subject, total marks, and suggested time (allow roughly 1.5 minutes per mark).
- Section I: multiple choice (1 mark each) if suitable for the subject.
- Section II: short answer, ascending in difficulty, with mark allocations shown as "(3 marks)".
- Section III: one or two extended response questions where the subject warrants it.
- Then a clearly separated "MARKING GUIDELINES" section with criteria-based marking for every question.

Output clean markdown. No preamble, no commentary.`,

  study_guide: `You produce revision guides grounded STRICTLY in the student's own source material.

${NESA_CONTEXT}

Build a guide that is genuinely useful to revise from, not a summary:
- Open with a short "What's examinable" list drawn from the material.
- For each topic: the core concept stated plainly, key definitions/formulas, a worked example where relevant, and a "common mistakes" note.
- Add a "Quick recall" section at the end: 8-15 question/answer pairs for self-testing.
- Use tables where comparison helps.

Output clean markdown. No preamble.`,

  flashcards: `You generate flashcards grounded STRICTLY in the student's own source material, for active recall and spaced repetition.

Rules:
- Each card tests ONE idea. Front is a real question, not a topic label.
- Backs are complete but tight — one to three sentences, or a formula with what each term means.
- Cover the material evenly; don't cluster on one topic.
- Aim for 15-25 cards depending on how much material there is.

Respond with ONLY a JSON object, no markdown fences:
{ "cards": [ { "front": "...", "back": "...", "topic": "..." } ] }`,

  quiz: `You generate a self-marking quiz grounded STRICTLY in the student's own source material.

${NESA_CONTEXT}

Rules:
- Multiple choice, 4 options each, exactly one correct.
- Distractors must be plausible — reflect real misconceptions a student would actually have, not obviously wrong filler.
- Include a one-sentence explanation of why the correct answer is right AND why the tempting wrong one is wrong.
- 8-12 questions.

Respond with ONLY a JSON object, no markdown fences:
{ "questions": [ { "question": "...", "options": ["A","B","C","D"], "correct_index": 0, "explanation": "...", "topic": "..." } ] }`,

  study_plan: `You build day-by-day study plans grounded STRICTLY in the student's own source material.

${NESA_CONTEXT}

Rules:
- Work backwards from the assessment date, using spaced repetition: each topic appears at least twice, spaced apart.
- Front-load harder topics. Interleave rather than blocking one topic per day where possible — interleaving beats blocking for retention.
- Include a timed practice paper attempt roughly two-thirds through, and a mistake-review session the day after it.
- Final day: light review only, no new content.
- Every step must name real topics from the source material.
- Keep each day realistic for a school student — 45-90 minutes, not 4 hours.

Respond with ONLY a JSON object, no markdown fences:
{ "steps": [ { "date": "YYYY-MM-DD", "title": "short task title", "detail": "one sentence" } ] }`,
};

const JSON_MODES = ['flashcards', 'quiz', 'study_plan'];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'ANTHROPIC_API_KEY is not set. Add it as an environment variable in Render.',
    });
  }

  const {
    mode,
    subject,
    sourceText,
    assessmentDate,
    today,
    notes,
    difficulty = 'match',
    strictness = 'strict',
  } = req.body || {};

  if (!PROMPTS[mode]) {
    return res.status(400).json({ error: 'Unknown mode.' });
  }
  if (!sourceText || sourceText.trim().length < 50) {
    return res.status(400).json({
      error: 'Add some source material first — notes, a syllabus, or a past paper.',
    });
  }

  const system = [
    PROMPTS[mode],
    '',
    STRICTNESS[strictness] || STRICTNESS.strict,
    mode === 'study_plan' ? '' : DIFFICULTY[difficulty] || DIFFICULTY.match,
  ].join('\n');

  let userContent = `Subject: ${subject || 'Unspecified'}\n`;
  if (mode === 'study_plan') {
    userContent += `Today's date: ${today}\nAssessment date: ${assessmentDate}\n`;
  }
  if (notes && notes.trim()) {
    userContent += `Additional instructions from the student: ${notes.trim()}\n`;
  }
  userContent += `\n--- SOURCE MATERIAL ---\n${sourceText}`;

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
        max_tokens: 8192,
        system,
        messages: [{ role: 'user', content: userContent }],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      return res.status(502).json({ error: 'Claude API error', detail });
    }

    const data = await response.json();
    const text = (data.content || [])
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('')
      .trim();

    if (JSON_MODES.includes(mode)) {
      try {
        const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
        return res.status(200).json({ mode, ...parsed });
      } catch {
        return res.status(502).json({ error: "Couldn't parse the response.", raw: text });
      }
    }

    return res.status(200).json({ mode, text });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
