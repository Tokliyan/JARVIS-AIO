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

## Nothing has reached `main` since 21 Sep (found 24 Sep 2026) — read this first

`origin/main` is still at `86896ef` (21 Sep). Every run since has committed to
the side branch `claude/kind-archimedes-nt6d8v` instead: **6 commits, 37 files,
~1,658 insertions** that have never landed on `main`.

    a8259b0  24 Sep  Kindle dashboard: Room and Needs attention sections
    7125d42  23 Sep  Record that the routine is blind to the Supabase roadmap
    3f463e3  23 Sep  /api/display JSON wrapper for trmnl-koreader
    d0290dc  23 Sep  Kindle PNG endpoint + browser preview page
    8b22bd4  23 Sep  E-ink endpoint, satellite ingestion, RoomCard real readings
    0b4615a  21 Sep  PWA + icons, skeletons, attempt tracking, command bar → Studyboy

This is the *same* failure the 22 Sep note described ("landed on a side branch,
so it never reached `main` and you never saw it") — it was reported as a
one-off, but it is the steady state. Two consequences:

1. If `main` is what deploys, none of the e-ink/Kindle work, the satellite
   endpoint, the PWA or the Studyboy work is live. It only exists on the branch.
2. The line below claiming PWA/icons/skeletons/Studyboy were "built and pushed
   on 21 Sep" is **wrong** — that's commit `0b4615a`, which is on the branch,
   not on `main`. Corrected below.

The routine is configured with `claude/kind-archimedes-nt6d8v` as its working
branch, which contradicts the "Push directly to `main`" line above. It did not
resolve that by force: merging six unreviewed commits into a deploying branch
isn't a call a routine should make unattended. **Your decision:** merge the
branch into `main` yourself, or change the routine's branch config to `main`,
or drop the "push to main" instruction from this file. Until one of those
happens, work keeps piling up where you won't see it.

## Routine can’t read the Supabase roadmap (found 22 Sep, re-verified 24 Sep 2026)

The routine only has the anon key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`). The REST
API *is* reachable (HTTP 200), but RLS hides every row from an unauthenticated
key: `aio_timetable`, `aio_checklist` and `aio_projects` all come back `[]`
with `content-range: */0`. Re-checked on 24 Sep — unchanged. So the routine
cannot see the roadmap at all, and an empty response is indistinguishable from
"nothing planned".

This also breaks the command bar loop: a `feature_request` tells you "Saved to
Ambient Intelligence's roadmap — needs an actual build session", but the build
session can't read it. Anything queued that way is invisible to this routine.

Until that's resolved, **this file is the only queue the routine can see.**
Your call which way to fix it: give the routine a service-role key in its env,
add an RLS policy letting the anon key read `aio_projects.roadmap`, or just
keep queueing work in this file.

## Queued

Nothing queued. Checked 24 Sep 2026: Supabase roadmap unreadable (above), and
no items listed here. The routine built nothing this run rather than inventing
work. If you queued something through the command bar, it is on the Supabase
roadmap and the routine cannot see it — add it here instead.

## Built — waiting on you to run the SQL

Still unrun as of 24 Sep 2026 (third consecutive check). Probed the API:
`aio_studyboy_attempts` and `aio_notification_log` both return `PGRST205`
(missing from the schema cache), so both features are still dormant.

These two are code-complete but live on the side branch, not `main` — so they
need *both* the merge above and the SQL below before they do anything. Until
then the app degrades quietly rather than erroring. Delete the line once run.

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
