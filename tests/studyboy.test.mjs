import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { GOOD_TOKEN } from './fakeSupabaseAdmin.mjs';

process.env.ANTHROPIC_API_KEY = 'test-key';

const srs = await import('../lib/srs.js');
const mastery = await import('../lib/mastery.js');
const session = await import('../lib/smartSession.js');
const smart = await import('../lib/studyboySmart.js');
const gen = await import('../lib/studyboyGenerate.js');
const docs = await import('../lib/documentText.js');
const { default: smartHandler } = await import('../pages/api/studyboy/smart.js');
const { default: extractHandler } = await import('../pages/api/studyboy/extract-document.js');

const NOW = new Date('2026-10-15T00:00:00Z');
const day = (n) => new Date(NOW.getTime() + n * 86_400_000).toISOString();

// ------------------------------------------------------------------ SRS

test('srs: a new card rated good comes back tomorrow, then in 3 days, then grows by ease', () => {
  let card = srs.newCardState(NOW);
  let r = srs.nextReview(card, 'good', NOW);
  assert.equal(r.interval_days, 1);
  assert.equal(r.reps, 1);
  assert.equal(r.due_at, day(1));

  r = srs.nextReview({ ...card, ...r }, 'good', NOW);
  assert.equal(r.interval_days, 3);

  r = srs.nextReview({ ...card, ...r }, 'good', NOW);
  assert.equal(r.interval_days, Math.round(3 * 2.5)); // 8
  assert.equal(r.reps, 3);
});

test('srs: again resets the ladder, costs ease, counts a lapse, due in 10 minutes', () => {
  const card = { ease: 2.5, interval_days: 12, reps: 4, lapses: 0 };
  const r = srs.nextReview(card, 'again', NOW);
  assert.equal(r.reps, 0);
  assert.equal(r.interval_days, 0);
  assert.equal(r.lapses, 1);
  assert.equal(r.ease, 2.3);
  assert.equal(new Date(r.due_at) - NOW, 10 * 60_000);
});

test('srs: ease never drops below 1.3, easy beats good beats hard', () => {
  let card = { ease: 1.35, interval_days: 10, reps: 5, lapses: 0 };
  assert.equal(srs.nextReview(card, 'again', NOW).ease, 1.3);
  const hard = srs.nextReview(card, 'hard', NOW).interval_days;
  const good = srs.nextReview(card, 'good', NOW).interval_days;
  const easy = srs.nextReview(card, 'easy', NOW).interval_days;
  assert.ok(hard < good && good < easy, `${hard} < ${good} < ${easy}`);
  assert.ok(hard >= 11, 'a later review always moves at least a day past the last interval');
});

test('srs: interval is capped at a year and bad ratings throw', () => {
  const r = srs.nextReview({ ease: 3, interval_days: 360, reps: 9 }, 'easy', NOW);
  assert.equal(r.interval_days, 365);
  assert.throws(() => srs.nextReview({}, 'maybe', NOW));
});

test('srs: due queue is most-overdue first and the deck summary counts right', () => {
  const cards = [
    { id: 'a', due_at: day(-1), last_reviewed_at: day(-3) },
    { id: 'b', due_at: day(-5), last_reviewed_at: null },
    { id: 'c', due_at: day(2), last_reviewed_at: day(-1) },
    { id: 'd', due_at: day(7), last_reviewed_at: day(-1) },
  ];
  assert.deepEqual(srs.dueQueue(cards, NOW).map((c) => c.id), ['b', 'a']);
  const s = srs.summariseDeck(cards, NOW);
  assert.equal(s.total, 4);
  assert.equal(s.due, 2);
  assert.equal(s.fresh, 1);
  assert.equal(s.nextDueAt, day(2));
});

test('srs: interval labels', () => {
  assert.equal(srs.formatInterval(10 * 60_000), '10m');
  assert.equal(srs.formatInterval(5 * 3_600_000), '5h');
  assert.equal(srs.formatInterval(4 * 86_400_000), '4d');
  assert.equal(srs.formatInterval(90 * 86_400_000), '3mo');
  assert.deepEqual(srs.previewIntervals(srs.newCardState(NOW), NOW), { again: '10m', hard: '1d', good: '1d', easy: '3d' });
});

// ------------------------------------------------------------------ mastery

const at = (i) => `2026-10-${String(1 + i).padStart(2, '0')}T00:00:00Z`;
const rows = (topic, flags) => flags.map((c, i) => ({ topic, correct: c, created_at: at(i) }));

test('mastery: needs more than two attempts before it has an opinion', () => {
  assert.equal(mastery.topicStatus(rows('t', [false, false])).status, 'new');
});

test('mastery: high accuracy with a clean finish is mastered; steady misses need work', () => {
  assert.equal(mastery.topicStatus(rows('t', [true, true, true, true, true])).status, 'mastered');
  assert.equal(mastery.topicStatus(rows('t', [false, false, true, false, false])).status, 'needs_work');
});

test('mastery: a bad start followed by three right in a row is improving, not needs-work', () => {
  assert.equal(mastery.topicStatus(rows('t', [false, false, false, true, true, true])).status, 'improving');
});

test('mastery: only the last 8 attempts count', () => {
  const flags = [false, false, false, false, false, false, true, true, true, true, true, true, true, true];
  assert.equal(mastery.topicStatus(rows('t', flags)).status, 'mastered');
});

test('mastery: topics come back weakest first, and focus picks the struggling ones', () => {
  const all = [
    ...rows('Atoms', [true, true, true, true]),
    ...rows('Bonding', [false, false, true, false]),
    ...rows('Acids', [true, false, true, true, false]),
    { topic: '', correct: false, created_at: at(0) },
  ];
  const m = mastery.buildMastery(all);
  assert.equal(m[0].topic, 'Bonding');
  assert.equal(m[m.length - 1].topic, 'Atoms');
  const f = mastery.focusTopics(m);
  assert.ok(f.includes('Bonding'));
  assert.ok(!f.includes('Atoms'));
  assert.ok(!f.includes('Unlabelled'));
});

test('mastery: 7-day activity summary', () => {
  const s = mastery.activitySummary(
    [
      { correct: true, created_at: '2026-10-14T00:00:00Z' },
      { correct: false, created_at: '2026-10-13T00:00:00Z' },
      { correct: true, created_at: '2026-09-01T00:00:00Z' },
    ],
    7,
    NOW,
  );
  assert.deepEqual(s, { questions: 2, correct: 1, accuracy: 0.5 });
});

// ------------------------------------------------------------------ session rules

test('session: fill answers match ignoring case, accents and punctuation; unsure is null, empty is false', () => {
  const q = { answer: 'Mitochondria', accept_also: ['the mitochondrion'] };
  assert.equal(session.checkFill(q, '  mitochondria. '), true);
  assert.equal(session.checkFill(q, 'The Mitochondrion'), true);
  assert.equal(session.checkFill({ answer: 'élan' }, 'elan'), true);
  assert.equal(session.checkFill(q, 'ribosome'), null);
  assert.equal(session.checkFill(q, '   '), false);
});

test('session: three clean answers step the level up, two misses step it down, streak resets on a move', () => {
  const r = (firstTry, level) => ({ firstTry, level });
  assert.equal(session.adaptLevel('match', [r(true, 'match'), r(true, 'match'), r(true, 'match')]), 'harder');
  assert.equal(session.adaptLevel('match', [r(false, 'match'), r(false, 'match')]), 'easier');
  assert.equal(session.adaptLevel('match', [r(true, 'match'), r(false, 'match'), r(true, 'match')]), 'match');
  // clean answers given at the OLD level don't count towards another step
  assert.equal(session.adaptLevel('harder', [r(true, 'match'), r(true, 'match'), r(true, 'match'), r(true, 'harder')]), 'harder');
  assert.equal(session.adaptLevel('harder', [r(true, 'harder'), r(true, 'harder'), r(true, 'harder')]), 'harder'); // already top
  assert.equal(session.adaptLevel('easier', [r(false, 'easier'), r(false, 'easier')]), 'easier'); // already bottom
});

test('session: summary lists the topics that were missed', () => {
  const s = session.sessionSummary([
    { firstTry: true, topic: 'A' },
    { firstTry: false, topic: 'B' },
    { firstTry: false, topic: 'B' },
  ]);
  assert.deepEqual(s, { answered: 3, clean: 1, missed: ['B'], accuracy: 1 / 3 });
});

// ------------------------------------------------------------------ question engine

test('smart: normaliseQuestions keeps good shapes, turns true/false into two options, drops junk and repeats', () => {
  const raw = [
    { kind: 'mc', topic: 'Atoms', question: 'What is in a nucleus?', options: ['Protons', 'Quarks', 'Ions', 'Bonds'], correct_index: 0, hint: 'h', explanation: 'e' },
    { kind: 'tf', topic: 'Atoms', question: 'Electrons are heavier than protons.', answer: false, hint: 'h', explanation: 'e' },
    { kind: 'short', topic: 'Bonds', question: 'Explain ionic bonding.', model_answer: 'Transfer of electrons.', key_points: ['transfer', 'ions'] },
    { kind: 'fill', topic: 'Cells', question: 'The ____ makes ATP.', answer: 'mitochondria' },
    { kind: 'fill', topic: 'Cells', question: 'No blank here.', answer: 'x' }, // no blank
    { kind: 'mc', question: 'Bad', options: ['a', 'b'], correct_index: 0 }, // 2 options
    { kind: 'mc', question: 'Out of range', options: ['a', 'b', 'c', 'd'], correct_index: 7 },
    { kind: 'essay', question: 'Unknown kind' },
    { kind: 'mc', topic: 'Atoms', question: 'What is in a nucleus', options: ['Protons', 'Quarks', 'Ions', 'Bonds'], correct_index: 0 }, // repeat in batch
    null,
  ];
  const out = smart.normaliseQuestions(raw, ['Name the parts of a cell.']);
  assert.deepEqual(out.map((q) => q.kind), ['mc', 'tf', 'short', 'fill']);
  assert.deepEqual(out[1].options, ['True', 'False']);
  assert.equal(out[1].correct_index, 1);
  assert.equal(out[2].key_points.length, 2);
  assert.ok(out.every((q) => q.id && q.topic));
});

test('smart: a question already asked is dropped even when slightly reworded', () => {
  const raw = [{ kind: 'mc', question: 'What particles are found in the nucleus of an atom?', options: ['a', 'b', 'c', 'd'], correct_index: 0 }];
  assert.equal(smart.normaliseQuestions(raw, ['What particles are found in the nucleus of an atom']).length, 0);
  assert.equal(smart.normaliseQuestions(raw, ['Describe how ionic bonds form']).length, 1);
});

test('smart: parseJson copes with fences and chatter around the object', () => {
  assert.deepEqual(smart.parseJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(smart.parseJson('Sure! {"a":2} hope that helps'), { a: 2 });
  assert.equal(smart.parseJson('nope'), null);
});

let calls;
function mockClaude(text, ok = true) {
  calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push(JSON.parse(init.body));
    return ok
      ? { ok: true, json: async () => ({ content: [{ type: 'text', text }] }) }
      : { ok: false, text: async () => 'boom' };
  };
}

const NOTES = 'Atoms are made of protons, neutrons and electrons. '.repeat(5);

test('smart: generateQuestions sends cached notes, the asked list and focus topics; returns validated questions', async () => {
  mockClaude(JSON.stringify({ questions: [{ kind: 'tf', topic: 'Atoms', question: 'Protons are positive.', answer: true }] }));
  const { status, body } = await smart.generateQuestions({
    subject: 'Science',
    sourceText: NOTES,
    asked: ['Old question one?'],
    focusTopics: ['Bonding'],
    level: 'harder',
  });
  assert.equal(status, 200);
  assert.equal(body.questions.length, 1);
  const sent = calls[0];
  assert.equal(sent.messages[0].content[0].cache_control.type, 'ephemeral');
  assert.match(sent.messages[0].content[0].text, /SOURCE MATERIAL/);
  const steer = sent.messages[0].content[1].text;
  assert.match(steer, /Focus topics: Bonding/);
  assert.match(steer, /Old question one\?/);
  assert.match(steer, /above the source material/); // harder
});

test('smart: too little material, a Claude failure and unusable output all fail cleanly', async () => {
  assert.equal((await smart.generateQuestions({ sourceText: 'tiny' })).status, 400);
  mockClaude('', false);
  assert.equal((await smart.generateQuestions({ sourceText: NOTES })).status, 502);
  mockClaude(JSON.stringify({ questions: [{ kind: 'mc', question: 'x' }] }));
  assert.equal((await smart.generateQuestions({ sourceText: NOTES })).status, 502);
});

test('smart: a first miss returns a guiding question; the second attempt never does', async () => {
  mockClaude(JSON.stringify({ verdict: 'partial', feedback: 'Close.', guiding_question: 'What happens to the electrons?' }));
  let r = await smart.gradeAnswer({ question: 'Explain ionic bonding.', modelAnswer: 'Electron transfer', studentAnswer: 'they join', attempt: 1 });
  assert.equal(r.body.verdict, 'partial');
  assert.equal(r.body.guiding_question, 'What happens to the electrons?');

  r = await smart.gradeAnswer({ question: 'Explain ionic bonding.', modelAnswer: 'Electron transfer', studentAnswer: 'they join', attempt: 2 });
  assert.equal(r.body.guiding_question, '');

  mockClaude(JSON.stringify({ verdict: 'correct', feedback: 'Yes.', guiding_question: 'ignored' }));
  r = await smart.gradeAnswer({ question: 'q', studentAnswer: 'a', attempt: 1 });
  assert.equal(r.body.guiding_question, '');

  assert.equal((await smart.gradeAnswer({ question: 'q', studentAnswer: '  ' })).status, 400);
  mockClaude(JSON.stringify({ verdict: 'maybe' }));
  assert.equal((await smart.gradeAnswer({ question: 'q', studentAnswer: 'a' })).status, 502);
});

// ------------------------------------------------------------------ practice test generation

test('practice test: question count and time limit are clamped, and the prompt asks for that many', async () => {
  assert.equal(gen.clampCount(2), 5);
  assert.equal(gen.clampCount(99), 40);
  assert.equal(gen.clampCount(undefined), 15);
  assert.equal(gen.clampMinutes(undefined, 20), 30);
  assert.equal(gen.clampMinutes(45, 20), 45);
  assert.equal(gen.clampMinutes(9999, 20), 30);

  mockClaude(JSON.stringify({ questions: [{ question: 'q', options: ['a', 'b', 'c', 'd'], correct_index: 0, explanation: 'e', topic: 't' }] }));
  const { status, body } = await gen.generateStudyMaterial({ mode: 'practice_test', subject: 'Science', sourceText: NOTES, count: 20 });
  assert.equal(status, 200);
  assert.equal(body.mode, 'practice_test');
  assert.equal(body.minutes, 30);
  assert.match(calls[0].messages[0].content, /Number of questions: 20/);
});

// ------------------------------------------------------------------ documents

async function zipOf(files) {
  const z = new JSZip();
  for (const [name, content] of Object.entries(files)) z.file(name, content);
  return z.generateAsync({ type: 'nodebuffer' });
}

const docx = () =>
  zipOf({
    '[Content_Types].xml':
      '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    '_rels/.rels':
      '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    'word/document.xml':
      '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Photosynthesis notes</w:t></w:r></w:p><w:p><w:r><w:t>Plants make glucose &amp; oxygen.</w:t></w:r></w:p></w:body></w:document>',
  });

const slideXml = (...paras) =>
  `<p:sld xmlns:a="a" xmlns:p="p"><p:txBody>${paras.map((t) => `<a:p><a:r><a:t>${t}</a:t></a:r></a:p>`).join('')}<a:p><a:fld type="slidenum"><a:t>9</a:t></a:fld></a:p></p:txBody></p:sld>`;

const pptx = () =>
  zipOf({
    'ppt/slides/slide2.xml': slideXml('Second slide', 'Fish &amp; chips'),
    'ppt/slides/slide1.xml': slideXml('Title slide'),
    'ppt/slides/slide10.xml': slideXml('Tenth slide'),
    'ppt/notesSlides/notesSlide2.xml': slideXml('Remember the diagram'),
  });

test('documents: docx text comes out with paragraphs and decoded entities', async () => {
  const r = await docs.extractDocument(await docx(), 'Notes.DOCX');
  assert.match(r.text, /Photosynthesis notes/);
  assert.match(r.text, /Plants make glucose & oxygen\./);
});

test('documents: pptx slides are in numeric order, notes attached, slide-number fields skipped', async () => {
  const r = await docs.extractDocument(await pptx(), 'deck.pptx');
  const order = [r.text.indexOf('Slide 1'), r.text.indexOf('Slide 2'), r.text.indexOf('Slide 10')];
  assert.ok(order.every((i) => i >= 0) && order[0] < order[1] && order[1] < order[2]);
  assert.match(r.text, /Fish & chips/);
  assert.match(r.text, /Notes: Remember the diagram/);
  assert.doesNotMatch(r.text, /\b9\b/);
});

test('documents: wrong types and broken files give friendly errors, never throw', async () => {
  assert.match((await docs.extractDocument(Buffer.from('x'), 'old.doc')).error, /\.docx/);
  assert.match((await docs.extractDocument(Buffer.from('x'), 'pic.png')).error, /Only/);
  assert.match((await docs.extractDocument(Buffer.from('not a zip'), 'bad.docx')).error, /Couldn't open/);
  const empty = await zipOf({ 'ppt/slides/slide1.xml': '<p:sld/>' });
  assert.match((await docs.extractDocument(empty, 'empty.pptx')).error, /No readable text/);
});

// ------------------------------------------------------------------ routes

function call(handler, { method = 'POST', headers = {}, body } = {}) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      status(c) { this.statusCode = c; return this; },
      json(b) { resolve({ status: this.statusCode, body: b }); },
    };
    handler({ method, headers, body }, res);
  });
}
const authed = { authorization: `Bearer ${GOOD_TOKEN}` };

test('routes: no token or a bad token is rejected before any Claude call', async () => {
  mockClaude('{}');
  assert.equal((await call(smartHandler, { body: { action: 'next' } })).status, 401);
  assert.equal((await call(smartHandler, { headers: { authorization: 'Bearer nope' }, body: { action: 'next' } })).status, 401);
  assert.equal((await call(extractHandler, { body: { base64: 'AA', fileName: 'a.docx' } })).status, 401);
  assert.equal(calls.length, 0);
  assert.equal((await call(smartHandler, { method: 'GET' })).status, 405);
});

test('routes: smart with a good token runs both actions; unknown action is 400', async () => {
  mockClaude(JSON.stringify({ questions: [{ kind: 'tf', question: 'Protons are positive.', answer: true }] }));
  const next = await call(smartHandler, { headers: authed, body: { action: 'next', subject: 'Science', sourceText: NOTES } });
  assert.equal(next.status, 200);
  assert.equal(next.body.questions[0].kind, 'tf');

  mockClaude(JSON.stringify({ verdict: 'correct', feedback: 'Yes.' }));
  const grade = await call(smartHandler, { headers: authed, body: { action: 'grade', question: 'q', studentAnswer: 'a' } });
  assert.equal(grade.body.verdict, 'correct');

  assert.equal((await call(smartHandler, { headers: authed, body: { action: 'nope' } })).status, 400);
});

test('routes: extract-document reads an uploaded docx', async () => {
  const base64 = (await docx()).toString('base64');
  const ok = await call(extractHandler, { headers: authed, body: { base64, fileName: 'Notes.docx' } });
  assert.equal(ok.status, 200);
  assert.match(ok.body.text, /Photosynthesis/);
  assert.equal((await call(extractHandler, { headers: authed, body: { base64, fileName: 'x.pdf' } })).status, 422);
  assert.equal((await call(extractHandler, { headers: authed, body: {} })).status, 400);
});
