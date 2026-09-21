# JARVIS AIO — Next Build

Read by the nightly build routine. Only real code changes belong here —
this repo can't build physical hardware.

Process:
- Run `npm run build` and confirm it succeeds before committing anything.
- Push directly to `main`.
- If something needs SQL run manually in Supabase, write it to a new file
  under /pending-sql/ and say so in the commit message.
- If Supabase is reachable, also mark the matching item "done" on the
  Ambient Intelligence roadmap once built. If not, just note it in the
  commit message.
- Once an item below is built and pushed, delete its line from this file.
- If something's ambiguous, leave a comment explaining what's unclear
  rather than guessing.

## Queued

1. **PWA support** — manifest.json, apple-touch-icon and related icons, and
   the meta tags needed so this can be added to an iPhone home screen and
   opens full-screen instead of inside browser chrome.

2. **App icon / favicon matching JARVIS AIO branding** — replace the Next.js
   default. Same palette as the rest of the site (accent green, warm
   near-white background). Bundle with #1.

3. **Studyboy: track quiz and flashcard results over time** — new table
   (e.g. aio_studyboy_attempts: subject, topic, correct boolean, mode,
   created_at), written on every quiz mark and flashcard rating. Surface a
   small "weak topics" widget on the Studyboy page from it.

4. **Loading skeletons** — replace plain "Loading…" text on Room, Projects,
   Timetable, and Studyboy history with a subtle skeleton shaped like the
   real content.

5. **Notifications log view** — a small section listing recently processed
   command-bar notifications: what was captured, which subject(s), whether
   a study plan got built. Currently invisible after the fact.

6. **Command bar → Studyboy generation** — e.g. "quiz me on Chemistry"
   should pull the most recently saved Chemistry material and generate a
   quiz directly, not just redirect to an empty Studyboy page.

## Not for this repo — tracked on the Ambient Intelligence Supabase roadmap

- Mechanic hardware: Tiny VU Speaker, Smart Satellite V2, Cyber Clock V2,
  Pocket AI Assistant, ceiling camera + projector, E-ink dashboard, MQTT hub.
