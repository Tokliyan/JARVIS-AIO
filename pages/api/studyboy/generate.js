// Server-side only. Uses ANTHROPIC_API_KEY, never exposed to the browser.
// Everything generated here is grounded in `sourceText` — the user's own material —
// rather than the model's general knowledge. That's what makes output feel authentic
// to their actual course rather than generic.

const PROMPTS = {
  past_paper: `You are generating a practice assessment paper for a student, grounded STRICTLY in the source material they provide.

Rules:
- Base every question on topics, terminology, and difficulty level actually present in the source material. Do not introduce topics it doesn't cover.
- Match the style and format of the source material where it's evident (e.g. if it's a NESA-style paper, mirror that structure).
- Produce a mix appropriate to the subject: multiple choice, short answer, and extended response as fits.
- Include mark allocations per question, and a total.
- After the paper, add a clearly separated "MARKING GUIDE" section with the answers and what earns each mark.
- Output clean markdown. No preamble, no commentary about what you're doing.`,

  study_guide: `You are producing a revision guide for a student, grounded STRICTLY in the source material they provide.

Rules:
- Condense the source material into something genuinely useful for revision — key concepts, definitions, formulas, worked patterns, common traps.
- Organise by topic, in the order the source material presents them.
- Do not add topics the source material doesn't cover, and do not pad.
- Use headings, short bullets, and tables where they genuinely help.
- Output clean markdown. No preamble.`,

  study_plan: `You are building a day-by-day study plan for a student preparing for an assessment, grounded STRICTLY in the source material they provide.

Rules:
- Work backwards from the assessment date to today, spreading topics sensibly with spaced repetition.
- Front-load harder/weaker topics, leave the final day for light review only — no new content.
- Include at least one timed practice paper attempt partway through, and a review of that attempt the day after.
- Every step must reference real topics from the source material.

Respond with ONLY a JSON object, no markdown fences:
{ "steps": [ { "date": "YYYY-MM-DD", "title": "short task title", "detail": "one sentence" } ] }`,
};

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

  const { mode, subject, sourceText, assessmentDate, today, notes } = req.body || {};

  if (!PROMPTS[mode]) {
    return res.status(400).json({ error: 'Unknown mode.' });
  }
  if (!sourceText || sourceText.trim().length < 50) {
    return res.status(400).json({
      error: 'Add some source material first — notes, a syllabus, or a past paper.',
    });
  }

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
        max_tokens: 4096,
        system: PROMPTS[mode],
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

    if (mode === 'study_plan') {
      try {
        const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
        return res.status(200).json({ mode, steps: parsed.steps || [] });
      } catch {
        return res.status(502).json({ error: "Couldn't parse the plan.", raw: text });
      }
    }

    return res.status(200).json({ mode, text });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
