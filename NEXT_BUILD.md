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

## Roadmap access — built 12 Oct 2026, blocked since (needs one Render setting)

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

**Status, checked 12 Oct 2026 by the build routine: still blocked —
`NIGHT_RUN_TOKEN` is missing from Render → Environment.** All three endpoints answer
`500 {"error":"NIGHT_RUN_TOKEN is not set on the server"}`, with or without a
token in the request, so the token this routine holds is not the problem and
neither is the deploy — that error string only exists in today's code, so Render
is running it. The server simply has no value to compare against.

What that blocks, until the variable is set:
- the roadmap stays unreadable, so no run can tell "nothing planned" from
  "couldn't look" (the anon key + RLS still returns `[]` directly from
  Supabase — that is the 20-day problem this API was built to route around);
- no roadmap item can be ticked off;
- **every** overnight job's report is rejected — Rade.XT, RuneHaven, this
  routine and the morning check all POST to `/api/nightrun/report` — so Daily
  Status → Night run and the Kindle will stay empty and the 5:52am morning
  check has nothing to read.

Fix: Render → jarvis-aio → Environment → add `NIGHT_RUN_TOKEN` with the same
value that is already in this routine's environment, then redeploy. One
variable clears all three.

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

Unknown — not "nothing". The Supabase roadmap could not be read on the 12 Oct
run (see "Roadmap access" above), and this file is only the fallback, so the
honest answer is "couldn't look", not "nothing planned" — the roadmap has been
unreadable to the routine for about three weeks. Nothing is queued *here*. (PWA support, the branded icon/favicon, loading
skeletons and command bar → Studyboy generation were built and pushed on
21 Sep 2026.)

## Built — SQL now run (001, 002, 003, 005): these features are live

Checked against the REST API on this run (12 Oct 2026). `aio_studyboy_attempts`,
`aio_notification_log`, `aio_study_resources` and `aio_night_runs` all answer
`200 []` now, where on the 11 Oct run all of them returned `PGRST205` (missing
from the schema cache). So you ran them — thank you. Nothing is waiting on you
for these four any more, and the features they feed turned themselves on:

- **Studyboy: track quiz and flashcard results over time** (`001`) — quiz marks
  and flashcard ratings now record, and the "Weak topics" widget at the top of
  Studyboy's Create tab will appear once there are a few attempts.
- **Notifications log view** (`002`) — processed command-bar notifications now
  log under Studyboy → Notifications.
- **Study resources per subject** (`003`) — the "Resources — <subject>" panel is
  visible and saves again. Links typed in before today were never stored and do
  need re-adding; nothing can vanish silently like that again.
- **Night Run reports** (`005`) — the table is there, so reports will store the
  moment the server can authenticate them. Right now it can't: see "Roadmap
  access" above, `NIGHT_RUN_TOKEN` is missing from Render.

The four `pending-sql/001|002|003|005` files can be deleted whenever you like —
kept for now only so this note can be checked against them.

## Still waiting on you to run the SQL

- **Studyboy doc numbers (optional)** →
  `pending-sql/004_aio_studyboy_doc_numbers.sql`. Verified unrun on this run:
  `aio_studyboy_docs.doc_number` still errors `42703` (column does not exist).
  Gives each Studyboy doc a stable `doc_number`, so "open doc 3" means the same
  doc even after an earlier one is deleted. Genuinely optional — the Kindle
  command route already numbers docs in upload order and works without it. Run
  it only if you want the numbers to stay put.

## Not for this repo — tracked on the Ambient Intelligence Supabase roadmap

- Mechanic hardware: Tiny VU Speaker, Smart Satellite V2, Cyber Clock V2,
  Pocket AI Assistant, ceiling camera + projector, E-ink dashboard, MQTT hub.
