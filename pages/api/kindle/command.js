// The Kindle's typed-command channel. The "Ask JARVIS" KOReader plugin POSTs a
// sentence here; this route works out what it means (Claude), does it against
// Supabase, and returns plain text for the Kindle to show.
//
//   POST /api/kindle/command
//   Authorization: Bearer <KINDLE_COMMAND_TOKEN>
//   { "text": "pull up doc 3 for chem notes" }
//   -> { ok: true, title, text, saved_id? }
//
// A Kindle can't log in, so access is a shared secret token, and the database
// is reached with the service-role key (lib/supabaseAdmin.js). That is why this
// route is deliberately narrow: it can read docs and the timetable, generate
// and save study material, and ADD a checklist task. It cannot edit or delete
// anything. User-level problems ("no doc 7") come back as ok:true with a
// message to display; only auth and server failures use HTTP error codes.

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { generateStudyMaterial } from '@/lib/studyboyGenerate';
import {
  OWNER_ID,
  MAX_COMMAND_CHARS,
  MAX_DOC_CHARS,
  extractToken,
  tokenOk,
  rateLimited,
  sydneyNow,
  addDaysISO,
  fmtTime,
  canonSubject,
  numberDocs,
  findDocs,
  describeDoc,
  formatDocList,
  formatOutput,
  mdToPlain,
  parseKindleIntent,
  MODES,
} from '@/lib/kindleCommand';

const MODE_LABEL = {
  past_paper: 'Past paper',
  study_guide: 'Study guide',
  flashcards: 'Flashcards',
  quiz: 'Quiz',
  study_plan: 'Study plan',
};

const HELP_TEXT = `ASK JARVIS — things you can type

Notes
  open doc 3
  pull up my chem notes
  list my history docs

Study material (built only from your notes)
  quiz me on doc 3
  flashcards for French
  practice paper for History
  study plan for Science, test on 29 Oct
  show my last quiz

Day
  what's on today
  what's due tomorrow
  add task: finish maths prac, due Friday`;

const reply = (title, text, extra = {}) => ({ ok: true, title, text, ...extra });

// aio_studyboy_docs.doc_number only exists once pending-sql/004 has been run.
// Until then fall back to the plain column list so the Kindle still works.
async function loadDocs(db) {
  let { data, error } = await db
    .from('aio_studyboy_docs')
    .select('id, subject, file_name, uploaded_at, doc_number, ocr_text');
  if (error && /doc_number/.test(error.message || '')) {
    ({ data, error } = await db
      .from('aio_studyboy_docs')
      .select('id, subject, file_name, uploaded_at, ocr_text'));
  }
  if (error) throw new Error(error.message);
  return numberDocs(data);
}

async function openDoc(db, intent) {
  const docs = await loadDocs(db);
  if (docs.length === 0) {
    return reply('No docs yet', 'Nothing saved in Studyboy yet. Add notes on the website first, then they will show up here.');
  }

  const hits = findDocs(docs, intent);
  const wantSubject = canonSubject(intent.subject);

  if (hits.length === 0) {
    if (intent.doc_number != null) {
      return reply(`No doc ${intent.doc_number}`, formatDocList(docs.slice(-8).reverse(), `There is no doc ${intent.doc_number}. Your latest docs:`));
    }
    return reply(
      'No match',
      formatDocList(docs.slice(-8).reverse(), `No docs found${wantSubject ? ` for ${wantSubject}` : ''}. Your latest docs:`),
    );
  }

  // "chem notes" with several candidates: ask, don't guess.
  if (hits.length > 1 && intent.doc_number == null) {
    return reply('Which doc?', formatDocList(hits.slice(0, 10), `${hits.length} docs match. Which one?`));
  }

  const d = hits[0];
  let body = (d.ocr_text || '').trim();
  const truncated = body.length > MAX_DOC_CHARS;
  if (truncated) body = body.slice(0, MAX_DOC_CHARS);

  const notes = [];
  if (wantSubject && canonSubject(d.subject) !== wantSubject) {
    notes.push(`Note: Doc ${d.n} is ${d.subject || 'not tagged with a subject'}, not ${wantSubject}.`);
  }
  if (truncated) notes.push(`(Showing the first ${MAX_DOC_CHARS.toLocaleString()} characters.)`);

  return reply(describeDoc(d), `${notes.length ? notes.join('\n') + '\n\n' : ''}${body || '(This doc has no text.)'}`);
}

async function listDocs(db, intent) {
  const docs = await loadDocs(db);
  const want = canonSubject(intent.subject);
  const list = findDocs(docs, { subject: want });
  return reply(
    want ? `${want} docs` : 'Your docs',
    formatDocList(list.slice(0, 25), want ? `${want} docs` : 'Your docs, newest first'),
  );
}

async function generate(db, intent, today) {
  const mode = MODES.includes(intent.mode) ? intent.mode : 'quiz';
  const label = MODE_LABEL[mode];
  const docs = await loadDocs(db);

  let sources = [];
  let subject = canonSubject(intent.subject);

  if (intent.doc_number != null) {
    const d = docs.find((x) => x.n === Number(intent.doc_number));
    if (!d) return reply(`No doc ${intent.doc_number}`, formatDocList(docs.slice(-8).reverse(), `There is no doc ${intent.doc_number}. Your latest docs:`));
    sources = [d];
    subject = subject || canonSubject(d.subject);
  } else if (subject) {
    // Same rule as the website's command bar: latest doc, topped up from the
    // next couple only if it's too thin to build from.
    sources = findDocs(docs, { subject }).slice(0, 3);
  } else {
    return reply('Which subject?', 'Say a subject or a doc number, e.g. "quiz me on doc 3" or "flashcards for French".');
  }

  if (sources.length === 0) {
    return reply(`No ${subject} material`, `No saved ${subject} material yet. Add some on the Studyboy page first.`);
  }

  let sourceText = '';
  for (const d of sources) {
    if (sourceText.length >= 50) break;
    sourceText += (sourceText ? '\n\n' : '') + (d.ocr_text || '');
  }
  sourceText = sourceText.slice(0, 20000);
  if (sourceText.trim().length < 50) {
    return reply('Too short', `The saved ${subject || 'doc'} text is too short to build from. Add more on the Studyboy page.`);
  }

  if (mode === 'study_plan' && !/^\d{4}-\d{2}-\d{2}$/.test(intent.assessment_date || '')) {
    return reply('When is the test?', 'A study plan needs a test date. Try: "study plan for Science, test on 29 Oct".');
  }

  const { status, body } = await generateStudyMaterial({
    mode,
    subject,
    sourceText,
    notes: intent.notes || '',
    assessmentDate: intent.assessment_date,
    today: today.iso,
    maxTokens: 6144,
  });
  if (status !== 200) throw new Error(body.error || "Couldn't build that.");

  const stamp = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'short', timeZone: 'Australia/Sydney' });
  const title = `${subject ? subject + ' — ' : ''}${label}, ${stamp}`;
  const { data: saved, error: saveErr } = await db
    .from('aio_studyboy_outputs')
    .insert({ user_id: OWNER_ID, subject: subject || null, mode, title, payload: body })
    .select('id')
    .single();

  let text = formatOutput(body);
  const notes = [`Built from: ${sources.map((d) => `Doc ${d.n}`).join(', ')}.`];
  notes.push(saveErr ? "(Couldn't save to history.)" : 'Saved to Studyboy history.');

  if (mode === 'study_plan' && intent.add_plan_to_checklist && body.steps?.length) {
    const rows = body.steps.map((s) => ({
      user_id: OWNER_ID,
      title: s.title,
      tag: `School · ${subject || 'Study'}`,
      due_date: s.date,
      priority: 'med',
    }));
    const { error } = await db.from('aio_checklist').insert(rows);
    notes.push(error ? "(Couldn't add the plan to your checklist.)" : `Added ${rows.length} steps to your checklist.`);
  }

  return reply(title, `${notes.join(' ')}\n\n${text}`, { saved_id: saved?.id || null });
}

async function lastOutput(db, intent) {
  let q = db.from('aio_studyboy_outputs').select('id, subject, mode, title, payload, created_at').order('created_at', { ascending: false }).limit(1);
  const subject = canonSubject(intent.subject);
  if (subject) q = q.eq('subject', subject);
  if (MODES.includes(intent.mode)) q = q.eq('mode', intent.mode);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  if (!data?.length) return reply('Nothing saved', 'No saved Studyboy material matches that yet.');
  return reply(data[0].title, formatOutput(data[0].payload), { saved_id: data[0].id });
}

async function summary(db, intent, today) {
  const scope = intent.scope === 'tomorrow' ? 'tomorrow' : 'today';
  const iso = scope === 'tomorrow' ? addDaysISO(today.iso, 1) : today.iso;
  const dow = new Date(`${iso}T00:00:00Z`).getUTCDay();
  const dayName = new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

  const [{ data: wk }, { data: periods }, { data: tasks }] = await Promise.all([
    db.from('aio_settings').select('value').eq('user_id', OWNER_ID).eq('key', 'current_week').maybeSingle(),
    db.from('aio_timetable').select('*').eq('user_id', OWNER_ID).eq('day_of_week', dow).order('start_time'),
    db.from('aio_checklist').select('*').eq('user_id', OWNER_ID).eq('due_date', iso),
  ]);
  // current_week describes this week; for tomorrow across a weekend it may
  // differ, so say which week the list is for rather than pretend.
  const week = wk?.value || 'A';
  const visible = (periods || []).filter((p) => !p.week_type || p.week_type === week);

  const schedule = visible.length
    ? visible.map((p) => `${fmtTime(p.start_time).padEnd(8)}${p.subject}${p.room ? `  (${p.room})` : ''}`).join('\n')
    : dow === 0 || dow === 6 ? 'No school.' : 'No periods found.';
  const due = tasks?.length
    ? tasks.map((t) => `${t.status === 'done' ? '[x]' : '[ ]'} ${t.title}`).join('\n')
    : 'Nothing due.';

  return reply(
    `${scope === 'today' ? 'Today' : 'Tomorrow'} — ${dayName}`,
    `Week ${week}\n\nSCHEDULE\n${schedule}\n\nDUE\n${due}`,
  );
}

async function addTask(db, intent) {
  const title = String(intent.title || '').trim().slice(0, 200);
  if (!title) return reply("Couldn't add that", 'I did not catch a task title. Try: "add task: finish maths prac, due Friday".');
  const due = /^\d{4}-\d{2}-\d{2}$/.test(intent.due_date || '') ? intent.due_date : null;
  const tag = intent.tag || 'General';
  const { error } = await db.from('aio_checklist').insert({ user_id: OWNER_ID, title, tag, due_date: due, priority: 'med' });
  if (error) throw new Error(error.message);
  return reply('Task added', `Added: ${title}${due ? `\nDue: ${due}` : ''}\nTag: ${tag}`);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const expected = process.env.KINDLE_COMMAND_TOKEN;
  if (!expected) {
    return res.status(500).json({ ok: false, error: 'KINDLE_COMMAND_TOKEN is not set. Add it in Render → Environment.' });
  }
  if (!tokenOk(extractToken(req), expected)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  if (rateLimited()) {
    return res.status(429).json({ ok: false, error: 'Too many commands. Wait a minute.' });
  }

  const text = String(req.body?.text || '').trim().slice(0, MAX_COMMAND_CHARS);
  if (!text) return res.status(400).json({ ok: false, error: 'No command text.' });

  const today = sydneyNow();
  const weekday = new Date(`${today.iso}T00:00:00Z`).toLocaleDateString('en-AU', { weekday: 'long', timeZone: 'UTC' });

  const { intent, error: parseError } = await parseKindleIntent(text, today.iso, weekday);
  if (parseError) return res.status(502).json({ ok: false, error: parseError });

  let db;
  try {
    db = supabaseAdmin();
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }

  try {
    let out;
    switch (intent.action) {
      case 'open_doc':
        out = await openDoc(db, intent);
        break;
      case 'list_docs':
        out = await listDocs(db, intent);
        break;
      case 'generate':
        out = await generate(db, intent, today);
        break;
      case 'last_output':
        out = await lastOutput(db, intent);
        break;
      case 'summary':
        out = await summary(db, intent, today);
        break;
      case 'add_task':
        out = await addTask(db, intent);
        break;
      case 'help':
        out = reply('Ask JARVIS', HELP_TEXT);
        break;
      default:
        out = reply("Can't do that yet", `${mdToPlain(intent.reason || 'I did not understand that.')}\n\n${HELP_TEXT}`);
    }
    return res.status(200).json(out);
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
