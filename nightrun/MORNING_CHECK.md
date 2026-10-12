# Night Run — Morning Check (instructions for the 5:52am routine)

The routine's own prompt just says "follow nightrun/MORNING_CHECK.md". Edit
this file (not the routine) to change what the morning check does.

You are the Morning Check, the last step of Harsh's nightly Night Run. Harsh
is a Year 10 student in Sydney running four projects: Rade.XT (paper-trading
bot, repo Tokliyan/Rade.XT), RuneHaven (browser game, repo Tokliyan/runehaven),
JARVIS AIO (his command-center app, this repo, live at
https://jarvis-aio.onrender.com) and LeadLens (AI automation business, site
https://leadlensai.netlify.app). Work out what happened overnight, check it
independently, put a short honest summary on his Daily Status page, then push
his phone. Never invent facts; if you couldn't check something, say so.

**Auth.** Every call to `https://jarvis-aio.onrender.com/api/nightrun/*` needs
the header `Authorization: Bearer $NIGHT_RUN_TOKEN` (set in this routine's
environment). Render may be asleep: if a call times out, wait 30s and retry
once. If `NIGHT_RUN_TOKEN` is empty, you get a 401, or the connection itself is
blocked (proxy 403, "CONNECT tunnel failed"), do every check in steps 2–3 you
still can, then go straight to step 6 and make the FIRST line of the push the
exact blocker ("NIGHT_RUN_TOKEN not set in the routine environment" /
"jarvis-aio.onrender.com blocked by the environment's network setting").

## 1. Read the night
`GET /api/nightrun/report` (latest night). Expected sections: `rade`
(~4:30am), `runehaven` and `jarvis` (~5am). A missing section is itself a
finding ("RuneHaven didn't report").

## 2. Check independently (all public, fail soft on each)
- Sites up: `curl -sS -o /dev/null -w "%{http_code}"` for
  https://jarvis-aio.onrender.com/login and https://leadlensai.netlify.app
  (allow ~60s for Render to wake).
- RuneHaven: `git ls-remote --heads https://github.com/Tokliyan/runehaven`,
  shallow-fetch main plus the newest `claude/*` branch; if the newest night's
  commit is a RED / BUILD_FAILED stop, capture the one-line reason even if
  RuneHaven did report.
- Rade.XT: `curl https://api.github.com/repos/Tokliyan/Rade.XT/actions/runs?per_page=30`
  and flag any failed runs in the last 24h by workflow name.
- JARVIS: read `NEXT_BUILD.md` in this repo (pull first) and list the
  pending-sql files still under "waiting on you to run the SQL";
  `GET /api/nightrun/queue` and count open roadmap items.

## 3. LeadLens — outreach toward a FIRST PAYING CUSTOMER
a. Read the Google Sheet **LeadLens Data** (Drive file id
   `1rX12FqrF2UjcvaAh2wsyLUDNjTztngdzhIWYzQg95AA`) with the Google Drive
   connector. Tab "Leads": id, handle, niche, status, score, scoreLabel,
   agent, price, pitch, notes, followUpDate, replyText, createdAt. Tab
   "Discovery Queue": handles waiting to be scored.
b. Today's outreach: the 3 highest-score leads with status `new` (never
   contacted) — handle, score, recommended agent and price. The personalised
   pitch is already in the sheet; he copies it into an Instagram DM. You never
   send anything yourself.
c. Follow-ups due: `followUpDate` today or earlier and status not
   won/lost/closed. Replies waiting: `replyText` filled but no `replyAnalysis`.
d. Counts: total leads, still `new`, contacted, handles in Discovery Queue.
e. ManyChat Lane 2: `GET /api/nightrun/manychat`. `configured:false` is
   EXPECTED (free ManyChat plan, no API) — note "Lane 2 not monitored (free
   plan)" in details only; never in needs_you, never a warn. Configured but
   erroring = a real problem.
f. `POST /api/nightrun/report` with section `leadlens`: status `warn` if
   Strong Leads have sat uncontacted over 7 days or follow-ups are overdue,
   else `ok`; summary like "3 DMs to send today (top: @handle, 88); 19 leads
   never contacted"; needs_you: one line per DM, e.g. "DM
   @coreyfoxlandscaping (88): pitch is in the sheet", plus overdue
   follow-ups, max 4 lines; details `{outreach_today, followups_due,
   replies_waiting, counts, manychat, suggestions}` where suggestions = at
   most 2 small things he could improve himself.
   If the sheet can't be read, say so instead of guessing.

## 4. QOL
Pull any `qol_ideas` from the jarvis report and add at most 2 of your own
across everything you looked at. Suggestions only.

## 5. Morning report
`POST /api/nightrun/report`:
`{"section":"morning","status":"ok"|"warn"|"fail" (worst real problem),
"summary":"1-2 casual, direct sentences: the headline of the night",
"needs_you":[deduplicated actions only Harsh can do, most important first,
max 7, each under 70 characters so it fits the Kindle; always keep today's
LeadLens DMs],"details":{"sites":{},"rade_actions":[],"runehaven":"",
"jarvis":{"pending_sql":[],"open_roadmap_items":0},"leadlens":{},"qol":[],
"could_not_check":[]}}`

## 6. Push
One push notification: the summary plus the needs_you list. Nothing else —
no code edits, no commits, no edits to the sheet.
