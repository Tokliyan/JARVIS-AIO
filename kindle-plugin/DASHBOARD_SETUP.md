# Kindle dashboard — setup, step by step

Four main pages (**Home**, **Weather**, **Projects**, **News**), a reading page
for news stories, and a detailed page for every project. Tap, swipe, and a
**Close** button that drops you back into your book.

Everything refreshes by itself. The morning routine reports to the app, and the
Kindle re-fetches every 15 minutes while the dashboard is open.

---

## What each page does

| Page | What's on it |
| --- | --- |
| **Home** | Today's date, weather, top story, schedule, due today, what needs you |
| **Weather** | Temperature, "Umbrella: needed / not needed" with leave-for-school and home temps, hour-by-hour chart with rain bars, 5 days, sunrise, sunset, UV |
| **News** | Markets strip (ASX 200, AUD/USD, Bitcoin, Ethereum) then 3 money and 3 politics headlines. Tap one to read it |
| **Story** | Large readable text split into pages. Next / Prev, swipe, or tap the screen edge |
| **Projects** | Every project with a progress bar, what was done last, what's next, and a black **NEEDS YOU** tag |
| **Project** | Four tabs: **Next** (needs-you, in progress with steps, queue with estimates and blockers), **Done** (grouped by day), **Nights** (each night's run), **Notes** |

Long lists split into pages automatically, with Prev / Next at the bottom.

## Controls

| Do this | It does |
| --- | --- |
| Tap a tab at the bottom | Home / Weather / Projects / News |
| Swipe left or right | Next or previous page (or story page) |
| Tap a headline | Opens the story |
| Tap a project | Opens it. Tap **Next / Done / Nights / Notes** to switch tabs |
| Tap **‹ Projects** or **‹ News** | Back |
| Tap the round **X** (top right) | Back to your book, same page |

---

## Part A — the server (once, about 5 minutes)

1. **Secret.** Any long random string, 40+ characters. This is
   `KINDLE_COMMAND_TOKEN`. If you set one up for the first dashboard or "Ask
   JARVIS", keep using it.
2. **Render.** `jarvis-aio` service → **Environment** → add
   `KINDLE_COMMAND_TOKEN` → **Save**. Render redeploys. (Nothing else is new:
   weather, markets and news use free public sources with no keys, and the font
   is bundled in the repo.)
3. **Check it's live.** When Render says *Live*, from any computer (replace the
   token):

   ```bash
   curl -sS -o home.png -D - \
     -H "Authorization: Bearer YOUR-TOKEN" \
     "https://jarvis-aio.onrender.com/api/kindle/page?p=projects" | head -8
   ```

   You want `HTTP/2 200`, an `x-kindle-zones:` header and an `x-kindle-pages:`
   header. Open `home.png`: it should be your projects list. The first call
   after a quiet spell can take up to a minute.

   `401` = token mismatch. `500` = `KINDLE_COMMAND_TOKEN` not set on Render.
   `404` = the new code hasn't deployed yet.

## Part B — the Kindle (about 10 minutes)

1. Plug the Kindle into your computer. It shows up as a drive.
2. **Replace the plugin.** Delete `koreader/plugins/askjarvis.koplugin` on the
   Kindle, then copy in the new `kindle-plugin/askjarvis.koplugin` folder from
   the repo. You should end up with
   `koreader/plugins/askjarvis.koplugin/main.lua` and `_meta.lua`.
   *You have to do this again for this version: the plugin changed.*
3. **Settings file** `koreader/settings/askjarvis.lua`. Keep your existing one.
   If you don't have one:

   ```lua
   return {
       base_url = "https://jarvis-aio.onrender.com",
       token = "PASTE-YOUR-KINDLE_COMMAND_TOKEN-HERE",
   }
   ```
4. Eject properly, then restart KOReader (menu → Exit → Restart).

## Part C — opening it

- **Menu:** tap the top of the screen → tools icon → **More tools → Ask JARVIS →
  Dashboard**.
- **One-tap shortcut (recommended):** top menu → **Settings → Taps and gestures
  → Gesture manager**, choose a gesture you don't use (for example *two-finger
  tap*), then **General → JARVIS dashboard**.

## Part D — keeping it on

The plugin stops the Kindle sleeping while the dashboard is open and turns
Wi-Fi back on for each refresh. KOReader's own power settings can still
interfere, so set these once (names vary a little between versions; if you
can't find one, tell me your version from menu → Help → About):

1. **Never auto-suspend:** Settings → Device → **Autosuspend timeout** → longest
   option or *never*.
2. **Wi-Fi stays on:** Settings → Network → turn **off** any "turn Wi-Fi off
   after / when idle" option.
3. **Leave it charging.** Staying on all day with Wi-Fi uses real battery. A
   charger on the desk is the reliable way to "stay online always".

## Part E — first-day check

1. Open the dashboard. Home loads in a few seconds.
2. Tap all four tabs.
3. **News:** tap a headline, read the first page, tap **Next** and swipe to turn
   the page, tap **‹ News**.
4. **Projects:** tap a project, tap each of the four tabs, tap **‹ Projects**.
5. Tap **X**: you're back in your book.
6. Leave it open 30 minutes. **Updated …** at the bottom should change on its own.
7. Leave it overnight and check it's still showing the right time in the morning.

## What you'll see fill in over the next few days

- **Done tab and "done · Mon"** use the dates the nightly build records when it
  finishes a roadmap item, and the items each night's report lists as built.
  Items finished before this version have no date, so they show as **Earlier**.
- **Steps, estimates and blockers** on the Next tab appear only for roadmap
  items that have them. They're optional fields on a roadmap item (`steps`,
  `estimate`, `blocked`). Anything missing is just hidden.
- **Markets:** a source that can't be reached shows a dash instead of a number.

## If something's wrong

| What you see | Likely cause |
| --- | --- |
| "Couldn't reach the server" | Kindle isn't on Wi-Fi, or Render is waking up. Wait a minute and tap a tab. |
| "The server rejected the access token" | `askjarvis.lua` token ≠ `KINDLE_COMMAND_TOKEN` on Render. |
| "Server error 500" | `KINDLE_COMMAND_TOKEN` missing on Render. |
| "Server error 404" | The new server code isn't deployed yet. |
| No **Dashboard** in the menu | Old plugin still installed or folder nested wrong. `main.lua` must be directly inside `askjarvis.koplugin`; restart KOReader. |
| Story says "Full story unavailable, showing the summary only" | ABC didn't return the page or it had no readable text. The summary still shows. |
| Weather or News says "unavailable" | The server couldn't reach that site just now. It shows the last good copy when it has one. |
| Taps do nothing or hit the wrong thing | Tell me the page and where you tapped. Tap zones come from the server so they're easy to adjust. |
| Dashboard closes by itself | Kindle slept. Redo Part D. |
| Text looks plain instead of the new font | The font files didn't deploy. Check `assets/fonts/` exists in the Render build. |

## What I couldn't test

The pages, paging, tap zones, token check and every fallback are covered by
automated tests, and I looked at the rendered pages. The plugin's tap, swipe,
page-change and close logic is tested against stand-ins for KOReader, not the
real thing. I couldn't reach ABC, Yahoo, CoinGecko, Frankfurter or Open-Meteo
from my workspace, so those feeds are tested with recorded-style sample replies.
Treat Part E as the real test and send me anything odd. The most likely
surprise is a source changing its format, which would show as a dash or
"unavailable" and is a small fix.
