# Ambient Intelligence Online

Personal command center — timetable, checklist, Studyboy, daily status, and every
project in one place. Software half of the Ambient Intelligence project (the
other half is Mechanic, the physical room hardware).

## Local setup

```bash
npm install
cp .env.example .env.local
# fill in .env.local with the Supabase URL + anon key from the Rade.XT project
# (Settings → API — this app reuses that project, it doesn't need its own)
npm run dev
```

Visit http://localhost:3000

## Login

One-time setup: in Supabase → Authentication → Users → **Add user**, create a
user with email `harsh@ambient-intelligence.local` and whatever password you
want to use to open the site. That email is just an ID, not a real inbox —
you'll never see or type it. The site itself only ever shows a password box.
Once signed in, the session just stays logged in (like most apps) until you
hit Sign out.

## Structure

```
pages/
  index.js       Section 1 — Timetable & Checklist (home page)
  login.js       Password screen
  status.js      Section 3 — Daily Status
  projects.js    Section 4 — Projects
  studyboy.js    Section 2 — Studyboy
  _app.js        Applies the sidebar + command bar to every page except /login
  _document.js   Fonts, loaded once
components/
  Sidebar.js
  CommandBar.js  Placeholder — wired up last, once every section exists
  AuthGate.js
  Checklist.js
  Timetable.js
lib/
  supabaseClient.js
styles/
  globals.css
```

Every page is one flat file — no folder-per-route nesting. Each of the four
main pages is currently a placeholder except `index.js`. Build order (matches
the spec): Section 1 first, then Daily Status, then Projects, then Studyboy,
then the Command Bar.

## Database

All tables live in the Rade.XT Supabase project, prefixed `aio_` to stay
separate from that project's own tables (`radext_...`). Schema + RLS policies
are in the AIO spec doc.

### Pending SQL

`/pending-sql/` holds migrations the nightly build routine wrote but can't run
itself — it has no database credentials. Run each one by hand in Supabase →
SQL Editor, then delete the file. Anything waiting on one of these degrades
quietly in the app (the feature stays hidden or unlogged) rather than erroring,
so there's no rush, but nothing new works until it's run.

### Studyboy tabs

- **Home**: what school has coming up (school checklist items and study-related notifications the command bar captured), a "Make a study guide" box (paste or upload notes, the notes are saved to Notes too), and recent guides and notes.
- **Notes**: every saved note, searchable across subjects. Open one to read, rename or edit it (editing needs `pending-sql/006`), make a study guide or quick revision sheet from it, or practise from it.
- **Guides**: every study guide. The reader has contents, key terms, formulas, comparison tables, step-by-step worked examples, common mistakes, memory tips, tap-to-reveal checks, a quick-recall self-test, a glossary, studied ticks, copy, download, print/PDF and "add questions to review deck". Guides are generated as JSON (`lib/studyGuide.js`) and also carried as markdown in `text`, so the Kindle and command bar still work.
- **Practice**: Smart Study, Review (spaced repetition, needs `006`), Progress (needs `001`; question text needs `006`), Quizzes & papers (past paper, flashcards, quiz, timed practice test, study plan) and History. Uses the open note, or every note saved for the subject.
- **Notifications**: what the command bar captured from school, study updates only by default.

The Smart Study and Word/PowerPoint routes check the signed-in session token (`lib/requireUser.js`); the browser sends it via `lib/authedFetch.js`.

## Deploying to Render

1. Push this repo to GitHub.
2. Render → New → **Web Service** (not Static Site) → connect the GitHub repo.
3. Build command: `npm run build` — Start command: `npm run start`
4. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as
   environment variables in Render's dashboard — never commit `.env.local`.
5. Auto-Deploy should be **On** by default for a GitHub-connected Web Service —
   double check in Settings, since that's what was missing on the Rade.XT
   dashboard's original static-site setup.
