# Leadlens content routine (instructions for the 6am routine)

Fires daily; posts go out every 2nd day. Output: one Instagram carousel plus
one Reel for the day's topic, rendered into `leadlens-content/out/<date>/`,
committed to main, and pushed to Harsh's phone with the steps to post.
Harsh is a Year 10 student in Sydney; the business is Leadlens (wordmark is
"Leadlens", never "LeadLens"). Never invent facts. Never post anything yourself.

## 1. Is today a post day?
- `git pull`. Today = Sydney date.
- Read `calendar.json` and `log.json` (list of generated ids; create `[]` if missing).
- Due if: today's date is in the calendar and not in the log; OR today is past
  the calendar and 2+ days have passed since the last logged date (then pick a
  new topic, see step 2). Otherwise stop silently. No push, no commit.
- If `out/<today>/reel.mp4` already exists, skip generation and go to step 5.

## 2. Pick the topic
- In the calendar: use that row's topic and hook.
- Past the calendar: pick ONE of the Leadlens agents/pain points not yet
  covered (read `log.json` topics). Cycle problem -> solution -> trust -> ask.
  Pain points: missed calls, slow DMs, manual booking, no-shows, review
  requests, quote follow-ups, FAQ questions, after-hours enquiries, rebooking
  lapsed customers. Say what it is and what it does, in plain words.
- Read the last 3 specs in `specs/` so you don't repeat wording.

## 3. Write `specs/<date>.json` (shape: see `specs/2026-10-23.json`)
Carousel: 5-7 body slides. Slide 1 is the hook, short (<= 10 words).
One idea per slide, headline <= 9 words, optional body <= 18 words.
`accent` = the 1-3 key words shown in lime (must appear in the headline).
Reel: 5 beats (4-7 allowed), ~20 seconds total including the end card the
renderer adds. Each beat is one line <= 75 chars. Flow: problem -> cost ->
"what if" -> example. Any simulated message goes in `bubble` (renderer adds
the "Example" label; never present an invented chat as a real client).
Caption: 2-3 short sentences, conversational, ends with the question or ask.
Hashtags: 4-6, local and small-business.

Hard rules (the renderer's lint also rejects most of these):
- "Leadlens" wordmark only. No name, age or school. No email address.
- No statistics, prices, percentages or invented numbers. No fake testimonials.
- Every post ends on "Comment AGENT and I'll send you the info" (renderer adds it).
- Flat brand: void black, lime accent, off-white text. Don't change styling.

## 4. Render
`python3 -I leadlens-content/render.py leadlens-content/specs/<date>.json`
Needs playwright + ffmpeg (preinstalled; if `playwright` import fails,
`pip install --break-system-packages playwright`; chromium is already in
/opt/pw-browsers, never run `playwright install`).
Exit 2 = lint failed: fix the spec and rerun, up to 3 times. Then LOOK at
`carousel-01.png`, one middle slide and `contact-sheet.png` (Read tool). If
text overflows or a line reads badly, fix the spec and rerun. Reel must be
14-28s.

## 5. Commit and report
- Append `{"date","topic","format":"carousel+reel"}` to `log.json`.
- `git add leadlens-content && git commit -m "Leadlens content <date>" && git push origin main`
  (rebase and retry once if the push is rejected).
- `POST https://jarvis-aio.onrender.com/api/nightrun/report` (header
  `Authorization: Bearer $NIGHT_RUN_TOKEN`) with section `leadlens`... ONLY if
  the Morning Check hasn't already posted that section today; otherwise skip
  the POST (never overwrite the morning's DM list). If it can't connect, skip it.
- ONE push notification: "Leadlens post ready: <topic>. 6 slides + Reel.
  Post between 6:30-7am or 7-9pm." plus the repo path
  `github.com/Tokliyan/jarvis-aio/tree/main/leadlens-content/out/<date>`. (Use
  the real repo owner/name from `git remote -v`.)
- Final reply: topic, the caption text, and the 3 posting steps below.

## Harsh's part (3 minutes)
1. Open the out/<date> folder on GitHub on your phone, save the slide PNGs
   and reel.mp4 to Photos (Download / Save image).
2. Instagram: + -> Post -> select the slides in order -> paste caption.txt
   -> Share. Then + -> Reel -> reel.mp4 -> paste the same caption -> Share.
3. Reply to every comment and DM within the hour. Keep AGENT as the trigger.
