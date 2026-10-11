import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { state, resetState } from './fakeSupabaseAdmin.mjs';

process.env.KINDLE_COMMAND_TOKEN = 'secret-token';
process.env.ANTHROPIC_API_KEY = 'test-key';

const { default: handler } = await import('../pages/api/kindle/command.js');
const k = await import('../lib/kindleCommand.js');

const OWNER = k.OWNER_ID;
const docs = [
  { id: 'd1', subject: 'Science', file_name: 'Chem atomic structure', uploaded_at: '2026-09-01T00:00:00Z', ocr_text: 'Atoms have protons, neutrons and electrons. '.repeat(10) },
  { id: 'd2', subject: 'History', file_name: 'WW1 causes', uploaded_at: '2026-09-02T00:00:00Z', ocr_text: 'The alliance system and militarism raised tensions. '.repeat(10) },
  { id: 'd3', subject: 'Science', file_name: 'Chem titration', uploaded_at: '2026-09-03T00:00:00Z', ocr_text: 'Titration finds the concentration of an unknown solution. '.repeat(10) },
];

let nextIntent;
let anthropicCalls;
function mockAnthropic() {
  anthropicCalls = [];
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    anthropicCalls.push(body);
    const isIntent = body.system.includes('turn one short command');
    let text;
    if (isIntent) text = JSON.stringify(nextIntent);
    else if (body.system.includes('self-marking quiz'))
      text = JSON.stringify({ questions: [{ question: 'What is in a nucleus?', options: ['Protons', 'Quarks', 'Ions', 'Bonds'], correct_index: 0, explanation: 'Protons and neutrons.', topic: 'Atoms' }] });
    else if (body.system.includes('study plans'))
      text = JSON.stringify({ steps: [{ date: '2026-10-20', title: 'Review atoms', detail: 'Read doc.' }, { date: '2026-10-27', title: 'Timed paper', detail: 'Attempt.' }] });
    else text = '## Study guide\n\n**Atoms** are tiny.\n\n- one\n- two';
    return { ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text }] }), text: async () => text };
  };
}

function call(text, { token = 'secret-token', method = 'POST' } = {}) {
  const req = { method, headers: token ? { authorization: `Bearer ${token}` } : {}, body: { text } };
  const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
  return handler(req, res).then(() => res);
}

beforeEach(() => {
  k._resetRateLimit();
  resetState({
    aio_studyboy_docs: docs,
    aio_settings: [{ user_id: OWNER, key: 'current_week', value: 'A' }],
    aio_timetable: [
      { user_id: OWNER, day_of_week: 1, subject: 'Science', room: 'IH410', start_time: '08:50', week_type: null },
      { user_id: OWNER, day_of_week: 1, subject: 'Commerce', room: 'BQ104', start_time: '09:55', week_type: 'A' },
      { user_id: OWNER, day_of_week: 1, subject: 'English', room: 'SO206', start_time: '09:55', week_type: 'B' },
    ],
    aio_checklist: [{ user_id: OWNER, title: 'Maths prac', due_date: '2026-10-12', status: 'open' }],
  });
  mockAnthropic();
});

test('rejects bad method, missing server token, wrong token, empty text', async () => {
  assert.equal((await call('x', { method: 'GET' })).code, 405);
  assert.equal((await call('x', { token: 'nope' })).code, 401);
  assert.equal((await call('x', { token: '' })).code, 401);
  assert.equal((await call('   ')).code, 400);
  const saved = process.env.KINDLE_COMMAND_TOKEN;
  delete process.env.KINDLE_COMMAND_TOKEN;
  assert.equal((await call('x')).code, 500);
  process.env.KINDLE_COMMAND_TOKEN = saved;
  assert.equal(anthropicCalls.length, 0, 'no Claude call before auth passes');
});

test('open doc by number returns its text', async () => {
  nextIntent = { action: 'open_doc', doc_number: 3, subject: 'Science' };
  const res = await call('pull up doc 3 for chem notes');
  assert.equal(res.code, 200);
  assert.match(res.body.title, /^Doc 3 · Science · Chem titration/);
  assert.match(res.body.text, /Titration finds/);
  assert.doesNotMatch(res.body.text, /Note:/);
});

test('open doc warns when the subject does not match the number', async () => {
  nextIntent = { action: 'open_doc', doc_number: 2, subject: 'Science' };
  const res = await call('doc 2 chem');
  assert.match(res.body.text, /Doc 2 is History, not Science/);
});

test('ambiguous subject asks which doc instead of guessing', async () => {
  nextIntent = { action: 'open_doc', doc_number: null, subject: 'Science' };
  const res = await call('chem notes');
  assert.equal(res.body.title, 'Which doc?');
  assert.match(res.body.text, /Doc 3 · Science/);
  assert.match(res.body.text, /Doc 1 · Science/);
  assert.doesNotMatch(res.body.text, /History/);
});

test('single subject match opens directly; unknown doc number lists latest', async () => {
  nextIntent = { action: 'open_doc', doc_number: null, subject: 'History' };
  assert.match((await call('history notes')).body.title, /^Doc 2 · History/);
  nextIntent = { action: 'open_doc', doc_number: 9, subject: null };
  const res = await call('doc 9');
  assert.equal(res.body.title, 'No doc 9');
  assert.match(res.body.text, /Doc 3/);
});

test('still works before the doc_number column exists', async () => {
  state.noDocNumberColumn = true;
  nextIntent = { action: 'open_doc', doc_number: 1, subject: null };
  const res = await call('open doc 1');
  assert.equal(res.code, 200);
  assert.match(res.body.title, /^Doc 1 · Science · Chem atomic structure/);
});

test('stored doc_number wins over upload order', async () => {
  resetState({ aio_studyboy_docs: docs.map((d, i) => ({ ...d, doc_number: [5, 6, 7][i] })) });
  nextIntent = { action: 'open_doc', doc_number: 6, subject: null };
  assert.match((await call('doc 6')).body.title, /^Doc 6 · History/);
});

test('generate a quiz from a doc: formats, saves to history, grounded in that doc only', async () => {
  nextIntent = { action: 'generate', mode: 'quiz', doc_number: 3, subject: null, notes: null };
  const res = await call('quiz me on doc 3');
  assert.equal(res.code, 200);
  assert.match(res.body.text, /QUESTIONS/);
  assert.match(res.body.text, /A\) Protons/);
  assert.match(res.body.text, /ANSWERS/);
  assert.match(res.body.text, /Built from: Doc 3\./);
  const out = state.inserts.find((i) => i.table === 'aio_studyboy_outputs');
  assert.equal(out.rows[0].user_id, OWNER);
  assert.equal(out.rows[0].mode, 'quiz');
  assert.equal(out.rows[0].subject, 'Science');
  const genCall = anthropicCalls.find((b) => !b.system.includes('turn one short command'));
  assert.match(genCall.messages[0].content, /Titration finds/);
  assert.doesNotMatch(genCall.messages[0].content, /alliance system/);
});

test('generate by subject needs a subject or number', async () => {
  nextIntent = { action: 'generate', mode: 'quiz', doc_number: null, subject: null };
  assert.equal((await call('quiz me')).body.title, 'Which subject?');
  assert.equal(anthropicCalls.length, 1, 'only the intent call, no generation spend');
});

test('markdown modes are stripped to plain text', async () => {
  nextIntent = { action: 'generate', mode: 'study_guide', subject: 'History', doc_number: null };
  const res = await call('history study guide');
  assert.match(res.body.text, /STUDY GUIDE/);
  assert.doesNotMatch(res.body.text, /\*\*|##/);
  assert.match(res.body.text, /• one/);
});

test('study plan needs a date; with one it can add steps to the checklist', async () => {
  nextIntent = { action: 'generate', mode: 'study_plan', subject: 'Science', assessment_date: null };
  assert.equal((await call('science study plan')).body.title, 'When is the test?');
  nextIntent = { action: 'generate', mode: 'study_plan', subject: 'Science', assessment_date: '2026-10-29', add_plan_to_checklist: true };
  const res = await call('science plan, test on 29 Oct, add to my tasks');
  assert.match(res.body.text, /Added 2 steps to your checklist/);
  const rows = state.inserts.find((i) => i.table === 'aio_checklist').rows;
  assert.equal(rows.length, 2);
  assert.equal(rows[0].user_id, OWNER);
  assert.equal(rows[0].tag, 'School · Science');
});

test('summary shows only this week’s periods and due tasks', async () => {
  nextIntent = { action: 'summary', scope: 'today' };
  // Fix "today" to Monday 12 Oct 2026 by faking the clock inside the handler's helper.
  const RealDate = Date;
  globalThis.Date = class extends RealDate {
    constructor(...a) { super(...(a.length ? a : ['2026-10-12T00:00:00Z'])); }
    static now() { return new RealDate('2026-10-12T00:00:00Z').getTime(); }
  };
  try {
    const res = await call("what's on today");
    assert.match(res.body.title, /^Today — Monday 12 October/);
    assert.match(res.body.text, /Week A/);
    assert.match(res.body.text, /Commerce/);
    assert.doesNotMatch(res.body.text, /English/);
    assert.match(res.body.text, /\[ \] Maths prac/);
  } finally {
    globalThis.Date = RealDate;
  }
});

test('add task writes one checklist row and nothing else', async () => {
  nextIntent = { action: 'add_task', title: 'Finish maths prac', due_date: '2026-10-16', tag: 'School · Maths' };
  const res = await call('add task finish maths prac due friday');
  assert.equal(res.body.title, 'Task added');
  assert.equal(state.inserts.length, 1);
  assert.deepEqual(
    { t: state.inserts[0].table, title: state.inserts[0].rows[0].title, due: state.inserts[0].rows[0].due_date },
    { t: 'aio_checklist', title: 'Finish maths prac', due: '2026-10-16' },
  );
});

test('edits and unknown commands are refused with no writes', async () => {
  nextIntent = { action: 'unknown', reason: 'Editing docs is not supported yet.' };
  const res = await call('delete doc 2');
  assert.equal(res.code, 200);
  assert.match(res.body.text, /not supported yet/);
  assert.equal(state.inserts.length, 0);
});

test('rate limit stops runaway use', async () => {
  nextIntent = { action: 'help' };
  let last;
  for (let i = 0; i < 21; i++) last = await call('help');
  assert.equal(last.code, 429);
});

test('helpers: Sydney date, subjects, markdown, tokens', () => {
  assert.equal(k.sydneyNow(new Date('2026-10-10T20:00:00Z')).iso, '2026-10-11'); // UTC evening is already Sunday in Sydney
  assert.equal(k.canonSubject('Chemistry'), 'Science');
  assert.equal(k.canonSubject('Maths Ext'), 'Mathematics Advanced');
  assert.equal(k.canonSubject('RE'), 'Religious Education');
  assert.equal(k.canonSubject('Woodwork'), null);
  assert.equal(k.mdToPlain('| a | b |\n|---|---|\n| 1 | 2 |'), 'a  |  b\n\n1  |  2');
  assert.equal(k.tokenOk('abc', 'abc'), true);
  assert.equal(k.tokenOk('abc', 'abd'), false);
  assert.equal(k.tokenOk('', 'abc'), false);
  assert.equal(k.addDaysISO('2026-10-31', 1), '2026-11-01');
});
