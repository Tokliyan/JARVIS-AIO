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

## Routine can't read the Supabase roadmap (found 22 Sep 2026)

The routine only has the anon key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`). The REST
API *is* reachable (HTTP 200), but RLS hides every row from an unauthenticated
key: `aio_timetable`, `aio_checklist` and `aio_projects` all come back `[]`
with `content-range: */0`. So the routine cannot see the roadmap at all, and an
empty response is indistinguishable from "nothing planned" — which means a
future run could go quiet forever instead of reporting that it's blind.

This also breaks the command bar loop: a `feature_request` tells you "Saved to
Ambient Intelligence's roadmap — needs an actual build session", but the build
session can't read it. Anything queued that way is invisible to this routine.

Until that's resolved, **this file is the only queue the routine can see.**
Your call which way to fix it: give the routine a service-role key in its env,
add an RLS policy letting the anon key read `aio_projects.roadmap`, or just
keep queueing work in this file.

## Queued

Nothing queued. (PWA support, the branded icon/favicon, loading skeletons
and command bar → Studyboy generation were built and pushed on 21 Sep 2026.)

## Built — waiting on you to run the SQL

Both still unrun as of 22 Sep 2026 — checked against the API, and
`aio_studyboy_attempts` and `aio_notification_log` both 404 as missing from
the schema cache, so both features are still dormant.

These two are code-complete and pushed. Each needs its SQL run by hand in
Supabase → SQL Editor before it does anything; until then the app degrades
quietly rather than erroring. Delete the line once you've run it.

- **Studyboy: track quiz and flashcard results over time** →
  `pending-sql/001_aio_studyboy_attempts.sql`. Every quiz mark and flashcard
  rating writes an attempt; the "Weak topics" widget at the top of Studyboy's
  Create tab reads them back. Widget stays hidden until the table exists.

- **Notifications log view** → `pending-sql/002_aio_notification_log.sql`.
  Processed command-bar notifications get logged with what was captured,
  which subjects, how many tasks, and whether a study plan was built. Shows
  up under Studyboy → Notifications. Processing still works without it; it
  just isn't logged.

## Not for this repo — tracked on the Ambient Intelligence Supabase roadmap

- Mechanic hardware: Tiny VU Speaker, Smart Satellite V2, Cyber Clock V2,
  Pocket AI Assistant, ceiling camera + projector, E-ink dashboard, MQTT hub.
