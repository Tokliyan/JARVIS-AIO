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

## ⚠️ Nothing has reached `main` since 21 Sep 2026 (found 26 Sep)

`main` is still at `86896ef`. This branch — `claude/kind-archimedes-cszdan` —
is **6 commits ahead of it**, and none of that work has ever been merged:

- `0b4615a` PWA + branded icons, loading skeletons, attempt tracking,
  notification log, command bar → Studyboy
- `8b22bd4` e-ink dashboard endpoint for Kindle, Satellite sensor ingestion,
  RoomCard prefers real readings over the weather stand-in
- `d0290dc` Kindle PNG endpoint + browser preview page
- `3f463e3` `/api/display` — the JSON wrapper trmnl-koreader expects
- `7125d42` the Supabase-roadmap note below
- `a8259b0` Kindle dashboard Room + Needs attention sections

So the earlier claims in this file that things were "built and pushed" are
misleading: they were pushed **to this branch**, not to `main`. Nothing is
deployed, and the 22 Sep "landed on a side branch so you never saw it"
problem is still happening — including to the note about it.

The routine's own environment is what's forcing this: it is pinned to the
branch `claude/kind-archimedes-cszdan` and is told never to push anywhere
else, which directly contradicts "push directly to `main`" above. **This
needs a human decision** — either merge this branch into `main` and keep
merging, or repoint the routine's designated branch at `main`. The routine
should not pick for you.

**Next action: merge `claude/kind-archimedes-cszdan` into `main`.**

## Routine still can't read the Supabase roadmap (re-verified 26 Sep 2026)

Unchanged since 22 Sep. The routine only has `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
The REST API is reachable (HTTP 200), but RLS hides every row from an
unauthenticated key — `aio_projects`, `aio_timetable` and `aio_checklist` all
return `[]` with `content-range: */0`. The roadmap itself lives in
`aio_projects.roadmap` (a JSON array of `{title, status, detail}`), so it is
inside exactly the rows that are hidden. `SUPABASE_SERVICE_ROLE_KEY` is not in
the routine's env either.

An empty response is indistinguishable from "nothing planned", so a run could
go quiet forever instead of reporting that it's blind.

This also breaks the command bar loop: a `feature_request` tells you "Saved to
Ambient Intelligence's roadmap — needs an actual build session", but the build
session can't read it. Anything queued that way is invisible to this routine.

Until that's resolved, **this file is the only queue the routine can see.**
Your call which way to fix it: give the routine a service-role key in its env,
add an RLS policy letting the anon key read `aio_projects.roadmap`, or just
keep queueing work in this file.

## Queued

Nothing queued — and nothing readable from the Supabase roadmap either (see
above), so "nothing queued" here does not mean "nothing planned".

## Built — waiting on you to run the SQL

All three unrun as of 26 Sep 2026, checked against the REST API:
`aio_studyboy_attempts`, `aio_notification_log` and `aio_study_resources` all
404 as missing from the schema cache, so all three features are dormant.

These are code-complete and pushed. Each needs its SQL run by hand in
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

- **Study resources per subject** → `pending-sql/003_aio_study_resources.sql`.
  *Not a queued item — a gap the routine found on 26 Sep.* The
  "Resources — <subject>" panel on Studyboy shipped back in `876f0ae` (it is
  on `main`) but `aio_study_resources` was never created and no migration was
  ever written for it. The panel fails silently: reads return nothing so it
  renders "No resource links yet", and every Save quietly does nothing. That's
  why it looked fine. Columns in 003 are taken directly from
  `components/StudyResources.js`, not guessed.

## Not for this repo — tracked on the Ambient Intelligence Supabase roadmap

- Mechanic hardware: Tiny VU Speaker, Smart Satellite V2, Cyber Clock V2,
  Pocket AI Assistant, ceiling camera + projector, E-ink dashboard, MQTT hub.
