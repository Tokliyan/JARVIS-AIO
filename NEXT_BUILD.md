# JARVIS AIO — Next Build

**Nightly RoadMap Build: start with `nightrun/ROADMAP_BUILD.md`.** It is the
full procedure: read the queue through the app (not the Supabase anon key),
retry a failed call once, build, report, and write the "Last check" note
below. Only real code changes belong here. This repo can't build physical
hardware.

This file holds the **current state only**. Each night replaces "Last check"
instead of adding to it. Past nights are in git history.

## Last check — 20 Nov 2026: BLIND

- Roadmap queue: FAILED. `GET /api/nightrun/queue` was blocked by this
  environment before the request left (no HTTP status), with curl and with
  node fetch.
- Last successful queue read: 19 Nov 2026 (4 projects, nothing open).
- Built: nothing.
- Daily Status report: FAILED. `POST /api/nightrun/report` was blocked the
  same way, so 18 and 20 Nov show as gaps on Daily Status and the Kindle.
- What it means: the app was never reached. Anything added to the roadmap
  after 19 Nov hasn't been seen yet.
- Fix: allow `jarvis-aio.onrender.com` in the routine's environment network
  settings, and set `NIGHT_RUN_TOKEN` there.
- Health: npm run build ok, npm test 79/79, NIGHT_RUN_TOKEN set.

## Queued

Nothing queued in this file. Roadmap items come from the queue API (below);
add a line here only for work that isn't on the roadmap.

## Built — waiting on you to run the SQL

Everything except one optional file has been run (001, 002, 003, 005 and 006
all confirmed live).

- **Studyboy doc numbers (optional)** →
  `pending-sql/004_aio_studyboy_doc_numbers.sql`. Still not run
  (`aio_studyboy_docs.doc_number` returns `42703`). It gives each Studyboy doc
  a stable `doc_number`, so "open doc 3" means the same doc even after an
  earlier one is deleted. The Kindle already numbers docs in upload order
  without it.

## Roadmap access

The routine reads the roadmap through the app, never with its own database
key:

- `GET  /api/nightrun/queue` → every roadmap item that isn't `done`.
  `?project=ambient` narrows it.
- `POST /api/nightrun/queue` → `{ project_id, title, status }` marks an item
  `in_progress` or `done` (the title must match exactly).
- `POST /api/nightrun/report` → the end-of-run report shown on Daily Status →
  Night run and on the Kindle.

All three need `Authorization: Bearer $NIGHT_RUN_TOKEN`, with the same value
set in Render → Environment and in the routine's environment. An error from
any of them is a failed check, never "nothing queued". The direct Supabase
read with the anon key always returns `[]` under RLS and isn't a fallback.

## Not for this repo — tracked on the Ambient Intelligence Supabase roadmap

- Mechanic hardware: Tiny VU Speaker, Smart Satellite V2, Cyber Clock V2,
  Pocket AI Assistant, ceiling camera + projector, E-ink dashboard, MQTT hub.
