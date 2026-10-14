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

## Unblocked — 14 Oct 2026: the roadmap reads fine, and nothing is queued

`NIGHT_RUN_TOKEN` **is** set in Render now, so the 13 Oct blocker (which used
to fill this section) is closed. Checked on this run:

- `GET /api/nightrun/queue` → **200** `{"projects_seen":4,"items":[]}`, and
  `?project=ambient` the same. That is the service-key read going through, so
  the roadmap was genuinely *readable* this run — and it genuinely has **no
  item that isn't `done`** across all 4 projects. Nothing was built
  this run because there was nothing to build, not because the roadmap was
  blind.
- `GET /api/nightrun/report` → 200, and `POST` → 200 (this run's `jarvis`
  section stored, `run_date` 2026-10-15), so the Night Run hub works end to
  end: jobs can report, and Daily Status → Night run and the Kindle card have
  data. To be exact about *whose* data: the night that has all four sections
  (`rade`, `runehaven`, `leadlens`, `morning`) is `run_date` **2026-10-14**,
  the previous one. This run posted at 05:17 Sydney on the 15th and was the
  first report in for 2026-10-15 — rade (~4:30am) and runehaven (~5am) were
  not in yet, which at that hour is "not yet", not "didn't report". The
  5:52am morning check is the one that decides that.
- `/login` → 200, `npm run build` succeeded, `npm test` 25/25.

**If you want this routine to build something, put it on a roadmap.** Add
items to the Ambient Intelligence project's roadmap in the app (status
`planned`), or add a line under "Queued" below. An empty queue means an idle
routine — which is the right outcome tonight, but it is the only reason
nothing shipped.

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
otherwise read as a real problem. Lesson: `git fetch` (or `git ls-remote`)
before trusting `origin/*` refs in a fresh clone — it happened again on the
14 Oct run, where the clone's `origin/main` read `d8a6f25` while the real
`main` was two commits further on at `4218a5b`.

One cosmetic thing that is real: every run gets its own
`claude/kind-archimedes-*` branch and pushes there as well as to `main`, so
`git ls-remote` counted 19 before the 11 Oct run pushed its own, so 20 now.
Harmless, since `main` has everything, but they can be deleted whenever you
feel like tidying.

## Queued

Nothing queued *in this file*. (PWA support, the branded icon/favicon, loading
skeletons and command bar → Studyboy generation were built and pushed on 21 Sep
2026.) The Supabase roadmap was read successfully on 14 Oct and is also empty
of open items — see the top section.

## Built — waiting on you to run the SQL

**Checked on the 13 Oct 2026 run, and re-checked on 14 Oct — still true:**
`aio_studyboy_attempts`, `aio_notification_log`, `aio_study_resources` and
`aio_night_runs` all answer **200** from the REST API now, where on 11 Oct
they all 404'd as missing from the schema cache (`PGRST205`). So 001, 002,
003 and 005 have been run — their features (Weak topics, the Notifications
log, Resources per subject, and Night Run report storage) are live, and
those four lines are deleted from this list accordingly.

One left, and it is the optional one:

- **Studyboy doc numbers (optional)** →
  `pending-sql/004_aio_studyboy_doc_numbers.sql`. Still unrun —
  `aio_studyboy_docs.doc_number` does not exist (`42703`), confirmed again on
  the 14 Oct run. Gives each Studyboy doc a stable `doc_number`, so "open doc 3" means
  the same doc even after an earlier one is deleted. Genuinely optional: the
  Kindle command route already numbers docs in upload order and works
  without it. Run it only if you want the numbers to stay put.

## Not for this repo — tracked on the Ambient Intelligence Supabase roadmap

- Mechanic hardware: Tiny VU Speaker, Smart Satellite V2, Cyber Clock V2,
  Pocket AI Assistant, ceiling camera + projector, E-ink dashboard, MQTT hub.
