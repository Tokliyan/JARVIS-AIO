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
- Finish every run by POSTing a report to `/api/nightrun/report` (section
  `jarvis`) — see "Roadmap access" below.
- If something's ambiguous, leave a comment explaining what's unclear
  rather than guessing.

## BLOCKED — 13 Oct 2026: the roadmap is unreadable again (needs you)

`NIGHT_RUN_TOKEN` is **not set in Render → Environment**. Every
`/api/nightrun/*` call returns `500 {"error":"NIGHT_RUN_TOKEN is not set on
the server"}` — checked on this run against `/queue`, `/queue?project=ambient`
and `/report`. The site itself is fine (`/login` → 200), and the deploy is
current (the error text comes from `lib/nightRun.js`), so this is only the
missing environment variable.

What it costs until you set it:

- **The roadmap is blind again.** Falling back to the Supabase REST API with
  the anon key still returns `[]` for `aio_projects` (RLS, as documented
  below) — so this run could not see a single roadmap item. That is *not*
  "nothing planned"; it is "could not look". Nothing was built this run, and
  nothing should be read into that.
- **No overnight job can report.** `POST /api/nightrun/report` is rejected
  the same way, for Rade.XT, RuneHaven, this routine and the 5:52am morning
  check alike, so Daily Status → Night run and the Kindle card have no data.
  This is now the only thing stopping the Night Run hub working end to end —
  `aio_night_runs` itself exists (see below).

Fix: Render → Environment → add `NIGHT_RUN_TOKEN` with the same value this
routine already has, and redeploy. Nothing in this repo needs changing.

## Roadmap access — fixed 12 Oct 2026 (Night Run)

The 20-day "roadmap blind" problem (anon key + RLS → every `aio_` table reads
as `[]`) is fixed without giving the routine a service-role key and without
opening any table to the public: the routine now asks the app instead.

- `GET  /api/nightrun/queue` → every roadmap item that isn't `done`, read
  server-side with the service key. `?project=ambient` narrows it.
- `POST /api/nightrun/queue` → `{ project_id, title, status }` to mark an item
  `in_progress` or `done` (exact title match).
- `POST /api/nightrun/report` → the routine's end-of-run report, which shows
  on Daily Status → Night run and on the Kindle.

All three need `Authorization: Bearer $NIGHT_RUN_TOKEN`. The token must be set
in **Render → Environment** (same value) and in the **routine's environment**.
If the routine sees a 401/500 from these, that's the thing to report — never
treat an error as "nothing queued".

## Closed: the "side-branch" alarm from the 9 Oct run was wrong (no action needed)

The 9 Oct run claimed the 6 and 7 Oct notes never reached `main`. That was
wrong — both commits were there all along (5634ad7, a818b15), and commit
e079451 retracted it. The cause was local: this container's freshly-cloned
`origin/main` ref lagged the real `main`, so the comparison looked like missing
runs. Kept here only because the bad claim is in `main`'s history and would
otherwise read as a real problem. Lesson, applied on this run: `git fetch`
before trusting `origin/*` refs in a fresh clone.

One cosmetic thing that is real: every run gets its own
`claude/kind-archimedes-*` branch and pushes there as well as to `main`, so
`git ls-remote` counted 19 before the 11 Oct run pushed its own, so 20 now.
Harmless, since `main` has everything, but they can be deleted whenever you
feel like tidying.

## Queued

Nothing queued *in this file*. (PWA support, the branded icon/favicon, loading
skeletons and command bar → Studyboy generation were built and pushed on 21 Sep
2026.) Note this says nothing about the Supabase roadmap, which could not be
read on 13 Oct — see the BLOCKED section at the top.

## Built — waiting on you to run the SQL

**Checked on the 13 Oct 2026 run, and this is good news:**
`aio_studyboy_attempts`, `aio_notification_log`, `aio_study_resources` and
`aio_night_runs` all answer **200** from the REST API now, where on 11 Oct
they all 404'd as missing from the schema cache (`PGRST205`). So 001, 002,
003 and 005 have been run — their features (Weak topics, the Notifications
log, Resources per subject, and Night Run report storage) are live, and
those four lines are deleted from this list accordingly.

One left, and it is the optional one:

- **Studyboy doc numbers (optional)** →
  `pending-sql/004_aio_studyboy_doc_numbers.sql`. Still unrun —
  `aio_studyboy_docs.doc_number` does not exist (`42703`), confirmed this
  run. Gives each Studyboy doc a stable `doc_number`, so "open doc 3" means
  the same doc even after an earlier one is deleted. Genuinely optional: the
  Kindle command route already numbers docs in upload order and works
  without it. Run it only if you want the numbers to stay put.

## Not for this repo — tracked on the Ambient Intelligence Supabase roadmap

- Mechanic hardware: Tiny VU Speaker, Smart Satellite V2, Cyber Clock V2,
  Pocket AI Assistant, ceiling camera + projector, E-ink dashboard, MQTT hub.
