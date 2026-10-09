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

## Ignore the "side-branch" alarm in this run's commit message (9 Oct 2026)

Mid-run, this run concluded that the 6 and 7 Oct notes had never reached
`main`, and said so in its commit message and briefly in this file. **That was
wrong, and there is nothing for you to fix.** `main` already had both commits
(5634ad7 on 6 Oct, a818b15 on 7 Oct), verified against the GitHub API after
the push.

The cause was local, not a delivery failure: this container's freshly-cloned
`origin/main` ref pointed at the 1 Oct commit while the real `main` was two
commits ahead, so comparing against it looked like two missing runs. `git push`
reported the true state (`a818b15..c332bc0`), which is what exposed the
mistake. Recorded here because the bad claim is already in `main`'s history and
would otherwise read as a real problem on a later pass. Lesson for future runs:
`git fetch` before trusting `origin/*` refs in a fresh clone.

One cosmetic thing that is real: every run gets its own
`claude/kind-archimedes-*` branch and pushes there as well as to `main`, so
there are 18 of them on the remote now. Harmless, since `main` has everything,
but they can be deleted whenever you feel like tidying.

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
