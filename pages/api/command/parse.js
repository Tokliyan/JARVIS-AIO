// Server-side only. The Anthropic API key lives here and never reaches the browser.
// This route returns structured INTENT only — it never touches the database.
// The client performs the actual read/write through the authenticated Supabase
// client, so Row Level Security keeps protecting everything automatically.

const SYSTEM_PROMPT = `You convert a user's short command into a structured action for a personal dashboard.

Respond with ONLY a JSON object, no markdown fences, no preamble.

Available actions:
- add_checklist: { "action": "add_checklist", "title": string, "tag": string, "due_date": "YYYY-MM-DD" or null, "priority": "low"|"med"|"high" }
- complete_checklist: { "action": "complete_checklist", "match": string }  // text to match against existing task titles
- add_period: { "action": "add_period", "subject": string, "day_of_week": 1-5, "period_number": number, "start_time": "HH:MM", "end_time": "HH:MM", "room": string or null }
- summary: { "action": "summary", "scope": "today"|"tomorrow" }
- log_project: { "action": "log_project", "project_match": string, "kind": "shipped"|"issue"|"note"|"milestone", "body": string }
- complete_routine: { "action": "complete_routine", "routine_match": string }
- add_routine: { "action": "add_routine", "name": string, "time_of_day": "morning"|"evening"|"anytime", "recurrence_days": number }
- open_studyboy: { "action": "open_studyboy", "mode": "past_paper"|"study_guide"|"flashcards"|"quiz"|"study_plan" }
- unknown: { "action": "unknown", "reason": string }

Tags should be one of: School, Rade.XT, RuneHaven, LeadLens, Ambient Intelligence, General.
For school subjects use "School · <Subject>", e.g. "School · Maths".
day_of_week: 1=Monday through 5=Friday.

For log_project, project_match is text to match a project name — the projects are Rade.XT, RuneHaven, LeadLens AI, and Ambient Intelligence. Default kind to "shipped" if they describe finishing something, "issue" if something broke, otherwise "note".
For open_studyboy, use it when they ask to make study material but haven't given source material in the command itself — they need to go to the Studyboy page to pick their material first.
Default priority to "med" if not implied. Default due_date to null if no date is mentioned.`;

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

  const { text, today } = req.body || {};
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'No command text provided.' });
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
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Today's date is ${today}. Command: ${text}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      return res.status(502).json({ error: 'Claude API error', detail });
    }

    const data = await response.json();
    const raw = (data.content || [])
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('')
      .replace(/```json|```/g, '')
      .trim();

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return res.status(502).json({ error: "Couldn't parse that command.", raw });
    }

    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
