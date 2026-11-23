# Kindle dashboard — setup, step by step

What you get: four pages on the Kindle (**Home**, **Weather**, **Projects**,
**News**), tap a project for its details, swipe left/right to change page, and a
**Close** button that drops you back into your book.

All the data refreshes by itself: the morning routine already reports to the app,
and the Kindle re-fetches every 15 minutes while the dashboard is open.

---

## Part A — the server (do this once, about 5 minutes)

1. **Pick a secret.** Any long random string, 40+ characters (a password
   generator is fine). This is `KINDLE_COMMAND_TOKEN`. If you already set one
   for "Ask JARVIS", keep using the same one.
2. **Put it on Render.** Render → your `jarvis-aio` service → **Environment** →
   add `KINDLE_COMMAND_TOKEN` = the secret → **Save**. Render redeploys.
3. **Check it's live.** Wait for the deploy to say *Live*, then from any
   computer run (replace the token):

   ```bash
   curl -sS -o home.png -D - \
     -H "Authorization: Bearer YOUR-TOKEN" \
     "https://jarvis-aio.onrender.com/api/kindle/page?p=home" | head -5
   ```

   You want `HTTP/2 200` and a header starting `x-kindle-zones:`. Open
   `home.png`, it should be your schedule. The first call after a quiet spell
   can take up to a minute while Render wakes up.

   `401` = the token doesn't match. `500` = `KINDLE_COMMAND_TOKEN` isn't set on
   Render. `404` = the new code hasn't deployed yet.

## Part B — the Kindle (about 10 minutes)

1. Plug the Kindle into your computer. It shows up as a drive.
2. **Replace the plugin.** Delete `koreader/plugins/askjarvis.koplugin` on the
   Kindle if it's there, then copy in the new folder
   `kindle-plugin/askjarvis.koplugin` from the repo. You should end up with
   `koreader/plugins/askjarvis.koplugin/main.lua` and `_meta.lua`.
3. **Settings file** `koreader/settings/askjarvis.lua`. Skip this if it already
   exists and has your token. Otherwise create it with:

   ```lua
   return {
       base_url = "https://jarvis-aio.onrender.com",
       token = "PASTE-YOUR-KINDLE_COMMAND_TOKEN-HERE",
   }
   ```
4. Eject the Kindle properly, then restart KOReader (menu → Exit → Restart, or
   hold power and restart).

## Part C — opening it

- **From the menu:** tap the top of the screen → the tools icon → **More tools →
  Ask JARVIS → Dashboard**.
- **One-tap shortcut (recommended):** top menu → **Settings → Taps and gestures
  → Gesture manager**, pick a gesture you don't use (for example *two-finger
  tap* or *swipe up along the bottom edge*), choose **General → JARVIS
  dashboard**. Now one gesture flips from your book to the dashboard.

On the dashboard:

| Do this | It does |
| --- | --- |
| Tap a tab at the bottom | Jump to Home / Weather / Projects / News |
| Swipe left or right | Next or previous page |
| Tap a project | Opens its details (where it's at, last night's run, open roadmap) |
| Tap **< Projects** | Back to the list |
| Tap **Close X** (top right) | Back to your book, same page |
| Tap the weather line or headline on Home | Jumps to Weather or News |

## Part D — keeping it on

The plugin does what it can (stops the Kindle sleeping while the dashboard is
open, and turns Wi-Fi back on for each refresh). KOReader's own power settings
can still turn things off, so set these once. Menu names change a little
between KOReader versions; if you can't find one, tell me your version
(menu → Help → About) and what you see.

1. **Never auto-suspend:** Settings → Device → **Autosuspend timeout** → set it
   to the longest option, or *never*.
2. **Wi-Fi stays on:** Settings → Network → turn **off** any "turn Wi-Fi off
   after / when idle" option, and turn **on** "restore Wi-Fi on wake" if it's
   there.
3. **Screensaver:** it doesn't show while the dashboard is open, so leave it.
4. **Leave it plugged in.** Staying on all day with Wi-Fi uses real battery.
   A charger on the desk is the reliable way to "stay online always".

## Part E — the first-day check

1. Open the dashboard. Home should load within a few seconds.
2. Tap each tab, then tap a project, then **< Projects**, then **Close X**.
3. Swipe left and right.
4. Leave it open for 30 minutes. Home's bottom line (**Updated 10:20pm**)
   should change by itself.
5. Leave it overnight. In the morning, check it still says the right time.

## If something's wrong

| What you see | Likely cause |
| --- | --- |
| "Couldn't reach the server" | Kindle isn't on Wi-Fi, or Render is waking up. Wait a minute and tap a tab. |
| "The server rejected the access token" | `askjarvis.lua` token ≠ `KINDLE_COMMAND_TOKEN` on Render. |
| "Server error 500" | `KINDLE_COMMAND_TOKEN` missing on Render. |
| "Server error 404" | The new server code isn't deployed yet. |
| No **Dashboard** in the menu | Old plugin still installed, or the folder is nested wrong. Check `main.lua` is directly inside `askjarvis.koplugin`, then restart KOReader. |
| Weather or News says "unavailable" | The server couldn't reach the weather/news site. It shows the last good copy when it has one. |
| Taps do nothing / wrong thing | Tell me the page and where you tapped. The tap zones come from the server so they're easy to adjust. |
| Dashboard closes by itself | KOReader's autosuspend or the Kindle slept. Redo Part D. |

## What I couldn't test

The pages, tap zones, token check and fallbacks are covered by automated tests,
and I looked at the rendered pages. The KOReader plugin (swiping, tapping,
gestures, keeping awake) can't be run outside a real KOReader, and the server
can't reach the weather/news sites from my workspace. Treat Part E as the real
test and send me anything odd.
