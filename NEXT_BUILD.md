# JARVIS AIO — Next Build

**Nightly RoadMap Build: start with `nightrun/ROADMAP_BUILD.md`.** It is the
full procedure: read the queue through the app (not the Supabase anon key),
retry a failed call once, build, report, and write the "Last check" note
below. Only real code changes belong here. This repo can't build physical
hardware.

This file holds the **current state only**. Each night replaces "Last check"
instead of adding to it. Past nights are in git history.

## Last check — 23 Nov 2026: OK

- Roadmap queue: read OK, 0 open items (4 projects seen).
- Last successful queue read: 23 Nov 2026.
- Built: nothing — the roadmap had no open items and nothing was queued in this
  file.
- Daily Status report: sent.
- What it means: quiet night by design — there was no work waiting, and the app,
  the token and the repo are all healthy.
- Health: npm run build ok, npm test 79/79, NIGHT_RUN_TOKEN set.

## Queued

Nothing queued in this file. Roadmap items come from the queue API (below);
add a line here only for work that isn't on the roadmap.

## Built — waiting on you to run the SQL

Everything except one optional file has been run (001, 002, 003, 005 and 006
all confirmed live).

- **Studyboy doc numbers (optional)** →
  `pending-sql/004_aio_studyboy_doc_numbers.sql`. Still not run as of the
  21 Nov check (`aio_studyboy_docs.doc_number` returned `42703` then; the night
  run has no way to re-check this itself). It gives each Studyboy doc
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
