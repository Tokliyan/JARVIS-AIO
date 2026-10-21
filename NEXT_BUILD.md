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

## Idle — 22 Oct 2026: roadmap reads fine, ninth night with nothing queued

Same shape as the last eight nights: the roadmap is readable and empty, and
that is the only reason this routine ships no feature work. Checked on this
run (22 Oct, 05:05 Sydney):

- `GET /api/nightrun/queue` → **200** `{"projects_seen":4,"items":[]}`, and
  `?project=ambient` identical. `projects_seen:4` is the proof the service-key
  read actually returned rows, so the roadmap was genuinely *readable*, and
  across all 4 projects there is no item whose status isn't `done`.
  (`openRoadmapItems` returns anything not `done`, so an empty list can't be a
  status-spelling artefact.) The first call of the run returned curl exit
  `000` on a 60s timeout — Render cold start, not an error from the app: the
  very next call answered 200, and so did two more.
- The direct Supabase REST read was tried first this run, as the routine's
  prompt asks, and behaved exactly as designed-against: `aio_projects` →
  `200 []` with the anon key under RLS, and `aio_roadmap_items` → `404
  PGRST205` (no such table — the roadmap lives in `aio_projects.roadmap`, not
  its own table). **That `[]` carries no information — only the queue
  endpoint counts.** Kept doing both so the contrast stays on the record.
- `/login` → 200, `npm run build` succeeded, `npm test` 79/79.
- Nothing was built, nothing invented. No ambiguous roadmap item to flag,
  because there is no roadmap item at all.
- Pending SQL unchanged: only the optional `004` is left
  (`aio_studyboy_docs.doc_number` still `42703`, re-confirmed this run).
  001/002/003/005/006 all still answer 200.
- `main` was at `e2f4cb2` before this run, matching `git ls-remote` exactly —
  no stranded work. This run's own branch is `claude/ecstatic-goldberg-v9hnr5`
  (the `kind-archimedes-*` series stopped); `git fetch` confirms it did not
  exist on the remote before this push.

**If you want this routine to build something, put it on a roadmap.** Add
items to the Ambient Intelligence project's roadmap in the app (status
`planned`), or add a line under "Queued" below.

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
2026.) The Supabase roadmap was read successfully on 22 Oct and is also empty
of open items — see the top section.

## Built — waiting on you to run the SQL

**Checked on the 13 Oct 2026 run, and re-checked on 14, 16, 17, 18, 19, 20, 21
and 22 Oct — still true:** `aio_studyboy_attempts`, `aio_notification_log`, `aio_study_resources`
and `aio_night_runs` all answer **200** from the REST API now, where on 11 Oct
they all 404'd as missing from the schema cache (`PGRST205`). So 001, 002,
003 and 005 have been run — their features (Weak topics, the Notifications
log, Resources per subject, and Night Run report storage) are live, and
those four lines are deleted from this list accordingly.

**New on the 17 Oct run: 006 has been run too.**
`pending-sql/006_aio_studyboy_review.sql` arrived with the Studyboy work in
PR #2 and never made it onto this list. It has since been applied:
`aio_studyboy_cards` answers `200 []`, and all four columns it adds to
`aio_studyboy_attempts` (`question`, `user_answer`, `kind`, `hint_used`)
read back `200`. So the Review tab's spaced-repetition deck, per-question
attempt history and note renaming are all live — nothing to do for it.

One left, and it is the optional one:

- **Studyboy doc numbers (optional)** →
  `pending-sql/004_aio_studyboy_doc_numbers.sql`. Still unrun —
  `aio_studyboy_docs.doc_number` does not exist (`42703`), confirmed again on
  the 22 Oct run. Gives each Studyboy doc a stable `doc_number`, so "open doc 3" means
  the same doc even after an earlier one is deleted. Genuinely optional: the
  Kindle command route already numbers docs in upload order and works
  without it. Run it only if you want the numbers to stay put.

## Not for this repo — tracked on the Ambient Intelligence Supabase roadmap

- Mechanic hardware: Tiny VU Speaker, Smart Satellite V2, Cyber Clock V2,
  Pocket AI Assistant, ceiling camera + projector, E-ink dashboard, MQTT hub.
