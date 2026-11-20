# Night Run — RoadMap Build (instructions for the ~5am routine)

The routine ("Jarvis AOI RoadMap Build") has a short prompt that says to
follow this file. To change what the nightly build does, edit this file, not
the routine.

You build whatever is queued on the Ambient Intelligence roadmap for JARVIS
AIO (this repo, live at https://jarvis-aio.onrender.com), then leave a short,
honest note of what happened. Never invent work, and never report a failed
check as a quiet night.

## 0. Setup

- Pull `main`. Before trusting a fresh clone's `origin/*` refs, compare with
  `git ls-remote origin main`: clones here have lagged the real `main` before.
- If `node_modules` is missing, run `npm ci`.
- Check that `NIGHT_RUN_TOKEN` is set. Only ever say "set" or "empty". Never
  print it, part of it, or its length.

## 1. Calling the app (applies to every call below)

Every call to `https://jarvis-aio.onrender.com/api/nightrun/*` needs the
header `Authorization: Bearer $NIGHT_RUN_TOKEN`. Use curl with a 90-second
limit (Render can take a while to wake up), for example:

```
curl -sS --max-time 90 -w '\nHTTP %{http_code}\n' \
  -H "Authorization: Bearer $NIGHT_RUN_TOKEN" \
  "https://jarvis-aio.onrender.com/api/nightrun/queue?project=ambient"
```

**Retry once.** If a call doesn't get a usable answer (it's refused or
blocked by the environment, the network or proxy errors, it times out, or the
server returns 5xx), wait 30 seconds and run the exact same command one more
time. Only one retry per call. Don't retry a 401 or a 400: those won't change.

**Don't work around a block.** If the environment refuses the call, don't try
another tool, another URL, a proxy, a cache or a mirror. A refusal is the
environment's decision; the fix is on Harsh's side (step 5 says what to write).

Keep the exact outcome of each attempt (the error text or the HTTP status).
You need it for the note.

## 2. Read the queue

`GET /api/nightrun/queue?project=ambient` returns
`{ items: [{ project_id, project, index, title, status }] }`, which is every
roadmap item that isn't `done`.

- **200:** these items are tonight's work, together with anything listed under
  "Queued" in `NEXT_BUILD.md`.
- **Failed twice:** build only what is listed under "Queued" in
  `NEXT_BUILD.md`, which is usually nothing. Don't treat the failed read as
  "nothing queued". The roadmap's real state is unknown tonight, and the note
  has to say so.
- **Don't use the direct Supabase REST read** with the anon key. RLS hides
  every `aio_` row from it, so it always returns `[]`, which tells you nothing.
  It isn't a fallback.

## 3. Build each item

For each item:

1. Implement it.
2. Run `npm run build` and confirm it succeeds before doing anything else.
   Then run `npm test`.
3. Commit and push to `main`.
4. If it needs SQL run by hand, write a new file under `/pending-sql/`, say so
   in the commit message, add it to "Built — waiting on you to run the SQL" in
   `NEXT_BUILD.md`, and mark the item `in_progress` (never `done`: Harsh marks
   it done once he has run the SQL). Otherwise mark it `done`.
5. To mark it, `POST /api/nightrun/queue` with
   `{ "project_id", "title" (exact), "status" }`. Use the same retry rule. If
   marking fails twice, say so in the note. The code is still pushed.
6. If an item is ambiguous, don't guess. Leave it unbuilt and say in the note
   exactly what is unclear.

## 4. Report to Daily Status

`POST /api/nightrun/report` with section `jarvis`, using the same retry rule:

```
{ "section": "jarvis",
  "status": "ok" | "warn" | "fail",
  "summary": "one or two plain sentences",
  "needs_you": ["things only Harsh can do"],
  "details": { "built": [], "pending_sql": [], "qol_ideas": [] } }
```

- If the queue read failed twice, use status `fail`. The summary's first
  sentence names the blocker, e.g. "Couldn't read the roadmap: the
  environment blocked jarvis-aio.onrender.com." Put the fix from the table in
  step 5 into `needs_you`.
- `qol_ideas`: at most 2 small improvements you noticed. These are optional,
  and the Morning Check picks them up.
- If the report itself fails twice, Daily Status and the Kindle will show a
  gap for this date. The note in `NEXT_BUILD.md` is then the only record, so
  it must be committed and pushed.

## 5. Write the note in NEXT_BUILD.md

**Replace** the whole `## Last check` section with this format. Don't append,
don't keep earlier nights, and don't add "re-checked on …" date lists anywhere
else in the file. Git history holds the past nights.

```
## Last check — <D Mon YYYY>: <OK | BLIND | PARTIAL>

- Roadmap queue: <read OK, N open items | FAILED twice: attempt 1 <outcome>; attempt 2 <outcome>>
- Last successful queue read: <D Mon YYYY>
- Built: <item titles with commit hashes | nothing>
- Daily Status report: <sent | FAILED twice: attempt 1 <outcome>; attempt 2 <outcome>>
- What it means: <one plain sentence>
- Fix: <one line from the table below; leave this line out when nothing failed>
- Health: npm run build <ok | failed>, npm test <passed>/<total>, NIGHT_RUN_TOKEN <set | empty>
```

- **OK**: the queue was read and the report was sent.
- **BLIND**: the queue couldn't be read.
- **PARTIAL**: the queue was read but something else failed (the report, or
  marking an item).
- Carry "Last successful queue read" forward from the previous note when
  tonight's read failed.

How to describe what you saw:

| What you saw | Write | What it means | Fix |
|---|---|---|---|
| Refused by the environment before any request went out (no HTTP status) | "blocked by this environment before the request left (no HTTP status)" | The app was never reached. Says nothing about Render or the token. | Allow `jarvis-aio.onrender.com` in the routine's environment network settings |
| Proxy 403, "CONNECT tunnel failed" | "blocked by the environment's network proxy" | Same as above | Same as above |
| Timed out or no connection after 90s | "no response within 90s" | Render is down or very slow | Check the Render dashboard for jarvis-aio |
| HTTP 401 | "HTTP 401: token rejected" | `NIGHT_RUN_TOKEN` is missing from the routine or doesn't match Render's | Set the same `NIGHT_RUN_TOKEN` in the routine's environment and in Render → Environment |
| HTTP 500 "NIGHT_RUN_TOKEN is not set on the server" | "HTTP 500: token not set on Render" | Render is missing the token | Add `NIGHT_RUN_TOKEN` in Render → Environment |
| Any other 5xx | "HTTP <code>: <error text>" | The app errored | Check Render's logs |

Also keep the rest of `NEXT_BUILD.md` current: delete "Queued" lines you
built, and update the pending-SQL list if it changed.

Commit message: `Nightly check <D Mon>: <OK | BLIND | PARTIAL> — <short reason>`,
for example `Nightly check 21 Nov: BLIND — queue blocked by the environment twice`.
Push it to `main`.
