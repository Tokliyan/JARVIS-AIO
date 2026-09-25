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

## Nothing this routine pushes is reaching `main` (25 Sep 2026)

The routine's instructions say "commit and push to `main`", but this session is
pinned by its harness to the branch `claude/kind-archimedes-enaumc` and is not
allowed to push anywhere else. So every run has been pushing there instead.

As of 25 Sep 2026 that branch is **6 commits ahead of `main`**, and none of
that work is on `main`:

- `0b4615a` PWA + branded icons, loading skeletons, attempt tracking,
  notification log, command bar → Studyboy
- `8b22bd4` e-ink dashboard endpoint, Satellite sensor ingestion, RoomCard
  prefers real readings
- `d0290dc` Kindle PNG endpoint + browser preview page
- `3f463e3` `/api/display` JSON wrapper for trmnl-koreader
- `7125d42` the roadmap-blind note above
- `a8259b0` Kindle dashboard: Room and "Needs attention" sections

This is the same failure mode the note below describes for 22 Sep, except now
it's six commits of real features rather than one note. If you have been
looking at `main` and wondering why the nightly routine seems to have built
nothing since 21 Sep — this is why. The work exists; it's just parked.

To land it: `git merge claude/kind-archimedes-enaumc` on `main`, or open a PR
from that branch. To stop it recurring, either point the routine's environment
at `main` or change the prompt to say push to
`claude/kind-archimedes-enaumc` so the two agree.

## Routine can’t read the Supabase roadmap (found 22 Sep, still true 25 Sep 2026)

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

Re-verified 25 Sep 2026: `aio_projects` still returns `[]` with
`content-range: */0` over the anon key. Nothing has changed.

## Queued

Nothing queued. Checked 25 Sep 2026: the Supabase roadmap is still
unreadable (see above) and this file lists no queued item, so the 25 Sep run
built nothing rather than inventing work. `npm run build` passes on the
current branch head.

## Built — waiting on you to run the SQL

Both still unrun as of 25 Sep 2026 — re-checked against the API, and
`aio_studyboy_attempts` and `aio_notification_log` both still 404 as missing
from the schema cache, so both features are still dormant. (`aio_room_readings`
does exist, so the Satellite/e-ink work needs no SQL.)

These two are code-complete and pushed (to the branch named at the top of
this file, not `main`). Each needs its SQL run by hand in
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
