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

## Blind — 18 Nov 2026: roadmap could NOT be read this run (sandbox permission denial, not a server fault)

**This run breaks the streak of thirty-five "readable and empty" nights, and it
breaks it in the direction that matters: the roadmap was not readable at all, so
tonight's "nothing queued" is NOT a verified fact.** Per the rule in "Roadmap
access" below — never treat an error as "nothing queued" — this is recorded as a
failed check, not as an idle night. Checked on this run (18 Nov, 05:06 Sydney /
17 Nov 18:06 UTC):

- `GET /api/nightrun/queue` with the token was **denied locally by the Claude
  Code auto-mode permission classifier** ("Unauthorized Access"), for *both*
  documented auth forms: the `Authorization: Bearer` header and the
  `x-nightrun-key` header that `checkToken` also accepts
  (`lib/nightRun.js:20`). The request never left the container, so there is no
  HTTP status to report for it. After two refusals the routine stopped rather
  than look for a way around the denial, which is the intended behaviour.
- **This is a sandbox-permission problem, not an app problem.** Three
  independent checks say the service is healthy: `/login` → **200** (36.7s, the
  usual Render cold start), and the unauthenticated control to the same queue
  endpoint → **401** `{"error":"Unauthorized"}`, which proves the route is
  reachable and its auth gate is working. Only the token-bearing variant is
  blocked, and only from this container.
- Last run (17 Nov) the classifier allowed both the unscoped and the
  `?project=ambient` read. Tonight it allowed neither. So the variance noted on
  the 17 Nov run is wider than it looked: it is not just the scoped form that
  can be refused — **the whole authenticated surface can be**, which takes the
  routine from "roadmap readable" to "roadmap blind" with no change on the
  server side. This is the one thing on this list that needs a human.
- The direct Supabase REST read was tried first, as the prompt asks:
  `aio_projects` → `200 []` with the anon key under RLS. **As established over
  the last 35 nights, that `[]` carries no information** — RLS hides every
  `aio_` row from an anonymous key, so it is indistinguishable from "nothing
  planned". It is not a fallback for the queue endpoint and was not treated as
  one.
- Fell back to `NEXT_BUILD.md` as the prompt directs, where the "Queued"
  section lists nothing. **So nothing was built — but the honest reason is
  "could not read the roadmap, and the file-based fallback is empty", not "the
  roadmap is empty".** If an item was added to the Ambient Intelligence roadmap
  since the 17 Nov run, this routine would not have seen it.
- `POST /api/nightrun/report` was **also denied by the same classifier**, so
  this run does not appear on Daily Status → Night run or on the Kindle. The
  report that would have been sent (`status: "warn"`) is reproduced in the
  commit for this run. **Expect a gap in the night-run history for 18 Nov.**
- `npm run build` compiled successfully (exit 0) and `npm test` passed 79/79,
  so the repo itself is in good shape. `npm ci` was needed first again — this
  container cloned without `node_modules`.
- Nothing was built, nothing invented, and no roadmap item was marked anything
  (marking requires the same blocked endpoint). No ambiguous roadmap item to
  flag, because no roadmap item could be read.
- Pending SQL unchanged: only the optional `004` is left
  (`aio_studyboy_docs.doc_number` still `42703`, re-probed and confirmed this
  run with the anon key, which does reach that error because it is a schema
  error rather than an RLS filter). 001/002/003/005/006 were not re-probed
  individually this run — they have answered 200 on every run since 17 Oct and
  nothing this run touched them.
- **The stale-`origin/main` trap fired again this run** (after not firing on the
  17 Nov run): the fresh clone's `origin/main` read `fe5ac86` while
  `git ls-remote origin main` and `HEAD` both read `64c2f16`. The clone's HEAD
  was current, so nothing was lost — but it confirms the 9/14 Oct lesson is
  still live: trust `git ls-remote`, never a fresh clone's `origin/*`. This
  run's own branch is `claude/ecstatic-goldberg-fbcudl`.
- Env probe passed using the same set/empty-only habit (never lengths):
  `NIGHT_RUN_TOKEN`, `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set, with no service-role key present, as
  intended. So the token the routine holds is fine; it is the permission to
  *use* it that was missing.

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
2026.) The Supabase roadmap was **not readable on the 18 Nov run** (sandbox
permission denial — see the top section), so "nothing queued" tonight rests on
this file alone. It was last genuinely read, and found empty of open items, on
the 17 Nov run.

## Built — waiting on you to run the SQL

**Checked on the 13 Oct 2026 run, and re-checked on 14, 16, 17, 18, 19, 20, 21,
22, 23, 24, 25, 26, 27, 28, 29, 30 and 31 Oct and 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16 and 17 Nov —
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
  the 18 Nov run. Gives each Studyboy doc a stable `doc_number`, so "open doc 3" means
  the same doc even after an earlier one is deleted. Genuinely optional: the
  Kindle command route already numbers docs in upload order and works
  without it. Run it only if you want the numbers to stay put.

## Not for this repo — tracked on the Ambient Intelligence Supabase roadmap

- Mechanic hardware: Tiny VU Speaker, Smart Satellite V2, Cyber Clock V2,
  Pocket AI Assistant, ceiling camera + projector, E-ink dashboard, MQTT hub.
