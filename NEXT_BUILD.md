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

## Routine can’t read the Supabase roadmap (found 22 Sep, still true 9 Oct 2026)

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

This note was first written on 22 Sep but landed on a side branch, so it never
reached `main` and you never saw it. Re-verified and landed here on 23 Sep, and
re-checked on 27, 28, 29 Sep, 1, 6, 7 and 9 Oct: `aio_projects`, `aio_checklist`
and `aio_timetable` all still return `[]` with an empty `content-range`. Ten
runs in a row now, spanning eighteen days, so any feature request you've dropped
into the command bar since 21 Sep is sitting in the roadmap unseen and unbuilt.

The roadmap is the `roadmap` JSONB column on `aio_projects`, so anon-key
blindness on that one table is the whole problem.

Recommendation, since this keeps recurring: **put a service-role key in the
routine's environment.** That's the only one of the three options that doesn't
change what the public can read — the anon key ships to every browser, so an
RLS policy opening `aio_projects` to it would make your projects and roadmap
world-readable to anyone who views source. I haven't written that policy as a
pending migration, because which trade-off to take is your call, not mine.

Until one of those happens, each run does what this one did: probe, find `[]`,
find nothing queued here, and stop.

## The side-branch problem happened again (found 9 Oct 2026)

The 22 Sep note above went missing because it landed on a side branch instead
of `main`. That has now happened twice more, and worse: the **6 Oct and 7 Oct**
nightly notes were committed to `claude/kind-archimedes-ful8e9` and, as far as
this run can tell, never reached GitHub at all — when today's run pushed that
branch, git reported it as a **new branch** on the remote. `main` was still
sitting on the 1 Oct commit. So the last two runs' findings were invisible to
you in exactly the way this file warned about, and were one container teardown
away from being lost outright.

Today's run pushed the branch and fast-forwarded `main` onto it, so 6 Oct,
7 Oct and 9 Oct are all on `main` now and nothing was lost. Worth knowing why it recurs,
though: this routine is handed a designated working branch by its environment
config, while this file and the routine's own prompt both say to push to
`main`. A run that follows only the branch config lands its work somewhere you
don't look. Each run from here will push the branch *and* fast-forward `main`,
but if you'd rather not depend on the routine getting that right, either drop
the designated-branch setting from the routine's environment or watch
`claude/kind-archimedes-ful8e9` alongside `main`.

## Queued

Nothing queued. (PWA support, the branded icon/favicon, loading skeletons
and command bar → Studyboy generation were built and pushed on 21 Sep 2026.)

## Built — waiting on you to run the SQL

All three still unrun as of 9 Oct 2026 — checked against the API;
`aio_studyboy_attempts`, `aio_notification_log` and `aio_study_resources` all
404 as missing from the schema cache (`PGRST205`), so all three features are
dormant. Eighteen days for the oldest. Every other table the code touches
(`aio_checklist`, `aio_timetable`, `aio_projects`, `aio_project_updates`, `aio_settings`,
`aio_routines`, `aio_routine_defs`, `aio_room_readings`, `aio_studyboy_docs`,
`aio_studyboy_outputs`) exists and answers 200, so these three are the only
schema gaps.

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
  This one is a catch-up rather than a new feature, and it was losing data:
  the "Resources — <subject>" panel shipped on 21 Sep without ever having a
  table, so every link typed into it failed to save, the panel reloaded empty,
  and nothing said why. Found on the 27 Sep run by checking every table the
  code touches against the API. The panel now hides itself until the table
  exists, and surfaces a save error instead of swallowing one, so nothing can
  disappear like that again — but any links you added before today are gone
  and will need re-adding once the SQL is run.

## Not for this repo — tracked on the Ambient Intelligence Supabase roadmap

- Mechanic hardware: Tiny VU Speaker, Smart Satellite V2, Cyber Clock V2,
  Pocket AI Assistant, ceiling camera + projector, E-ink dashboard, MQTT hub.
