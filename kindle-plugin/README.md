# Ask JARVIS — Kindle plugin

Type a command on the Kindle ("pull up doc 3 for chem notes", "quiz me on doc 3",
"what's due tomorrow"), read the answer on the Kindle.

The plugin is deliberately thin. It sends the sentence you typed to
`POST /api/kindle/command` on your JARVIS server and shows the text that comes
back. Understanding the sentence (Claude), reading your notes and building study
material all happen on the server. So:

| Change | How it ships | Touch the Kindle? |
| --- | --- | --- |
| New command, better answers, new layout | push to GitHub, Render redeploys | No |
| Plugin menu / keyboard behaviour | replace the plugin folder (below) | Yes, rarely |

This plugin runs alongside the existing `trmnl-koreader` dashboard plugin. It
does not touch it.

## 1. Server side (once)

1. Pick a long random secret: `openssl rand -hex 24` (or any 40+ character string).
2. Render → your web service → **Environment** → add `KINDLE_COMMAND_TOKEN` = that secret.
   `ANTHROPIC_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` must already be set (Studyboy and
   the e-ink pages use them).
3. Optional but recommended: run `pending-sql/004_aio_studyboy_doc_numbers.sql` in the
   Supabase SQL Editor so "Doc 3" stays the same doc even if an earlier one is deleted.
   Without it, docs are numbered in upload order.

## 2. Install on the Kindle

1. Plug the Kindle into a computer. It shows up as a drive.
2. Copy the whole folder `kindle-plugin/askjarvis.koplugin` into
   `koreader/plugins/` on the Kindle. You should end up with
   `koreader/plugins/askjarvis.koplugin/main.lua`. (The other plugins, including
   the trmnl one, are already in that same folder.)
3. Create the settings file `koreader/settings/askjarvis.lua` with this content
   (typing a long token on the e-ink keyboard is painful, so do it from the computer):

   ```lua
   return {
       base_url = "https://jarvis-aio.onrender.com",
       token = "PASTE-THE-KINDLE_COMMAND_TOKEN-HERE",
   }
   ```
4. Eject the Kindle, restart KOReader.

## 3. Use it

KOReader menu (the top-of-screen menu) → the tools/gear area → **More tools → Ask JARVIS**.
Pick **Ask…**, type a sentence, **Send**. The reply opens as a scrollable page;
**Ask again** at the bottom takes you straight back to the keyboard. **Recent commands**
re-sends one of your last eight.

Things to try first: `help`, `what's on today`, `list my docs`, `open doc 1`.

## What it can and cannot do (v1)

Can: open and list your Studyboy docs; generate a past paper, study guide, flashcards,
quiz or study plan from a doc (saved to Studyboy history); reopen your last output;
show today's or tomorrow's schedule and tasks; add a checklist task.

Cannot yet: edit or delete anything. Editing a doc by instruction needs versioning and
a "confirm first" step, which comes next.

## If something goes wrong

- *"Couldn't reach the server"* — Wi-Fi, or the Render service is asleep. Try again in a
  minute; the first request after a quiet spell can be slow.
- *"The server rejected the access token"* — the token in `askjarvis.lua` doesn't match
  `KINDLE_COMMAND_TOKEN` on Render.
- *The menu item isn't there* — check the folder is exactly `askjarvis.koplugin` and that
  `main.lua` and `_meta.lua` are directly inside it; restart KOReader. Tell me your
  KOReader version (menu → Help → About) and what you see.
- Server errors show on the Kindle as text. The full detail is in Render's logs.

## Test the server without the Kindle

```bash
curl -s https://jarvis-aio.onrender.com/api/kindle/command \
  -H "Authorization: Bearer $KINDLE_COMMAND_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text":"what is on today"}'
```
