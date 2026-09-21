// Server-side only. The Anthropic API key lives here and never reaches the browser.
// This route returns structured INTENT only — it never touches the database.
// The client performs the actual read/write through the authenticated Supabase
// client, so Row Level Security keeps protecting everything automatically.

const SYSTEM_PROMPT = `You convert a user's short command into a structured action for a personal dashboard.

Respond with ONLY a JSON object, no markdown fences, no preamble.

Available actions:
- add_checklist: { "action": "add_checklist", "title": string, "tag": string, "due_date": "YYYY-MM-DD" or null, "priority": "low"|"med"|"high" }
- complete_checklist: { "action": "complete_checklist", "match": string }  // text to match against existing task titles
- add_period: { "action": "add_period", "subject": string, "day_of_week": 1-5, "period_number": number, "start_time": "HH:MM", "end_time": "HH:MM", "room": string or null, "week": "A"|"B"|null }
- bulk_add_periods: { "action": "bulk_add_periods", "periods": [ { "subject": string, "day_of_week": 1-5, "period_number": number, "start_time": "HH:MM", "end_time": "HH:MM", "room": string or null, "week": "A"|"B"|null } ] }
- summary: { "action": "summary", "scope": "today"|"tomorrow" }
- log_project: { "action": "log_project", "project_match": string, "kind": "shipped"|"issue"|"note"|"milestone", "body": string }
- update_project: { "action": "update_project", "project_match": string, "field": "name"|"status_label"|"status_color"|"last_update"|"next_milestone", "value": string }
- add_roadmap_item: { "action": "add_roadmap_item", "project_match": string, "title": string, "status": "done"|"in_progress"|"planned" }
- complete_routine: { "action": "complete_routine", "routine_match": string }
- add_routine: { "action": "add_routine", "name": string, "time_of_day": "morning"|"evening"|"anytime", "recurrence_days": number }
- generate_study: { "action": "generate_study", "subject": "Mathematics Advanced"|"Science"|"English"|"French"|"Commerce"|"History"|"Religious Education"|"PDHPE", "mode": "past_paper"|"study_guide"|"flashcards"|"quiz", "notes": string or null }
- open_studyboy: { "action": "open_studyboy", "mode": "past_paper"|"study_guide"|"flashcards"|"quiz"|"study_plan" }
- feature_request: { "action": "feature_request", "summary": string }
- process_notification: { "action": "process_notification", "subjects": ["Mathematics Advanced"|"Science"|"English"|"French"|"Commerce"|"History"|"Religious Education"|"PDHPE"|"General", ...], "summary": string, "checklist_items": [ { "title": string, "due_date": "YYYY-MM-DD"|null, "priority": "low"|"med"|"high" } ], "has_assessment": boolean, "assessment_date": "YYYY-MM-DD"|null }
- unknown: { "action": "unknown", "reason": string }

Tags should be one of: School, Rade.XT, RuneHaven, LeadLens, Ambient Intelligence, General.
For school subjects use "School · <Subject>", e.g. "School · Maths".
day_of_week: 1=Monday through 5=Friday.

For log_project, project_match is text to match a project name — the projects are Rade.XT, RuneHaven, LeadLens AI, and Ambient Intelligence. Default kind to "shipped" if they describe finishing something, "issue" if something broke, otherwise "note".
Use generate_study when they name a subject from the fixed list and ask for study material from it — "quiz me on Chemistry", "flashcards for French", "make me a practice paper for History". The app already has their most recently saved material for each subject, so it can build this straight away without them going anywhere. Put any steer they gave ("focus on trig identities") into notes. Map informal subject names onto the fixed list — e.g. Chemistry/Biology/Physics are all "Science", Maths is "Mathematics Advanced", RE is "Religious Education".
Use open_studyboy only when they ask to make study material WITHOUT naming a subject that maps onto the list, or they want a study plan (which needs an assessment date they have to pick on the page) — they need to go to the Studyboy page to choose material there.
For update_project, this can rename a project or change its status — this IS a real database field, unlike the site's own name which is not stored anywhere and cannot be changed this way.
Use process_notification when the student pastes or attaches something that reads like a school notification, newsletter excerpt, portal/app message, or announcement, rather than giving a direct instruction. subjects is one or more of the fixed list above (or "General" if it doesn't fit a subject) — include every subject it's actually relevant to, not just one. Pull out any real action items (permission notes, things to bring, due dates) as checklist_items. Only set has_assessment true when this clearly describes a graded test or assessment with an identifiable date; don't guess a date that isn't stated.
Use feature_request whenever the command describes a UI, layout, or code change to this app itself rather than a data operation — e.g. "separate X from Y on the timetable page", "add a dark mode", "make the sidebar collapsible", "rename the whole site". This is not something the command bar can build live (that requires an actual development session with build verification, not a runtime database write), so instead of attempting it or just refusing, capture it as a short, clear one-line summary suitable for a project roadmap. Reserve "unknown" only for genuinely unclear or nonsensical input, not for valid feature ideas.
Default priority to "med" if not implied. Default due_date to null if no date is mentioned.

The timetable supports a rotating fortnightly A/B schedule via the "week" field on each period. Use "week": null for a class that happens every week regardless of rotation. Only set "A" or "B" if the student's message actually describes a rotating/alternating schedule (e.g. "Period 3 is Maths on A week and Science on B week").
Use bulk_add_periods whenever more than one period is being described in a single message — e.g. a pasted timetable, a photo of one, or a list like "Monday: English 9-10, Maths 10-11". Use add_period only for a single period. Do not ask the student to repeat themselves one period at a time when they've already given you the whole thing at once — extract every period you can from what they gave you, even from a messy or partial photo transcription.`;

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
