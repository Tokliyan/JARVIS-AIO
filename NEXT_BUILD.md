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

## Checked — 19 Nov 2026: roadmap readable again, and empty (last night's blind spot left nothing behind)

The authenticated read worked this run, so tonight's "nothing queued" is a
**verified fact** rather than the unverified one the 18 Nov run had to record.
Checked on this run (19 Nov, 05:04 Sydney / 18 Nov 18:04 UTC):

- `GET /api/nightrun/queue` with the token → **200**
  `{"projects_seen":4,"items":[]}`, both scoped (`?project=ambient`) and
  unscoped. Four projects were seen and **zero roadmap items are anything other
  than `done`**, so there is nothing planned or in progress anywhere on the
  roadmap, not just on Ambient Intelligence.
- **This closes the 18 Nov blind run with no work lost.** That run could not
  read the roadmap and warned that an item added since 17 Nov would have gone
  unseen. Tonight's read answers that: any such item would still be open and
  would appear in this list, and the list is empty. So nothing was missed.
- **The 18 Nov denial was intermittent, and the variance is still unexplained.**
  Nothing changed on the server between the two runs — 17 Nov allowed both read
  forms, 18 Nov allowed neither, 19 Nov allowed both again. Worth knowing when
  reading these notes: a single "roadmap blind" night is not evidence of an app
  or token problem, and this routine will keep recording it as a failed check
  rather than an idle one.
- The direct Supabase REST read was tried first, as the prompt asks:
  `aio_projects` → `200 []` with the anon key under RLS. **As established over
  the last 36 nights, that `[]` carries no information** — RLS hides every
  `aio_` row from an anonymous key, so it is indistinguishable from "nothing
  planned". It is not a fallback for the queue endpoint and was not treated as
  one. The queue endpoint is what tonight's verdict rests on.
- `NEXT_BUILD.md`'s own "Queued" section also lists nothing, so file and
  roadmap agree this run.
- Nothing was built, nothing invented, and no roadmap item was marked anything
  (there was no item to mark). No ambiguous roadmap item to flag.
- `POST /api/nightrun/report` → **200**, so this run does appear on Daily
  Status → Night run and on the Kindle, as `jarvis` / `ok` for run date
  2026-11-19. **The 18 Nov gap in that history is still a gap** — that run's
  report was blocked locally and cannot be backfilled from here.
- `npm run build` compiled successfully (exit 0) and `npm test` passed 79/79.
  `npm ci` was needed first again — this container cloned without
  `node_modules`.
- Pending SQL unchanged: only the optional `004` is left
  (`aio_studyboy_docs.doc_number` still `42703`, re-probed and confirmed this
  run with the anon key, which does reach that error because it is a schema
  error rather than an RLS filter). 001/002/003/005/006 were not re-probed
  individually this run — they have answered 200 on every run since 17 Oct and
  nothing this run touched them.
- **The stale-`origin/main` trap did not fire this run:** the fresh clone's
  `origin/main`, `git ls-remote origin main` and `HEAD` all read `0886852`.
  Checked anyway, per the 9/14 Oct lesson — trust `git ls-remote`, never a
  fresh clone's `origin/*`. This run's own branch is
  `claude/ecstatic-goldberg-to78bx`.
- Env probe passed using the same set/empty-only habit (never lengths):
  `NIGHT_RUN_TOKEN`, `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set, with no service-role key present, as
  intended.

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
2026.) The Supabase roadmap **was read successfully on the 19 Nov run** and
holds no open items either — 4 projects seen, nothing not `done` — so "nothing
queued" tonight is confirmed on both sources, not just this file.

## Built — waiting on you to run the SQL

**Checked on the 13 Oct 2026 run, and re-checked on 14, 16, 17, 18, 19, 20, 21,
22, 23, 24, 25, 26, 27, 28, 29, 30 and 31 Oct and 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16 and 17 Nov (and the roadmap itself re-read clean on 19 Nov) —
still true:** `aio_studyboy_attempts`, `aio_notification_log`, `aio_study_resources`
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
  the 19 Nov run. Gives each Studyboy doc a stable `doc_number`, so "open doc 3" means
  the same doc even after an earlier one is deleted. Genuinely optional: the
  Kindle command route already numbers docs in upload order and works
  without it. Run it only if you want the numbers to stay put.

## Not for this repo — tracked on the Ambient Intelligence Supabase roadmap

- Mechanic hardware: Tiny VU Speaker, Smart Satellite V2, Cyber Clock V2,
  Pocket AI Assistant, ceiling camera + projector, E-ink dashboard, MQTT hub.
