import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.ANTHROPIC_API_KEY = 'test-key';

const sg = await import('../lib/studyGuide.js');
const gen = await import('../lib/studyboyGenerate.js');
const cu = await import('../lib/comingUp.js');
const notes = await import('../lib/notes.js');
const { parseBlocks } = await import('../lib/markdownBlocks.js');

const RAW = {
  title: 'Cell division',
  overview: 'How cells copy themselves.',
  examinable: ['Describe the stages of mitosis', '', 42],
  topics: [
    {
      title: 'Mitosis',
      summary: 'One cell becomes two identical cells.',
      key_points: ['PMAT order', null],
      key_terms: [
        { term: 'Chromatid', definition: 'One copy of a replicated chromosome' },
        { term: 'Bad', definition: '' },
      ],
      formulas: [{ name: 'Cells after n divisions', expression: '2^n', meaning: 'n = number of divisions' }],
      tables: [
        { title: 'Mitosis vs meiosis', columns: ['', 'Mitosis', 'Meiosis'], rows: [['Daughter cells', '2', '4', 'extra']] },
        { title: 'broken', columns: ['only one'], rows: [['x']] },
      ],
      example: { prompt: 'How many cells after 3 divisions?', steps: ['2^3', '= 8'], answer: '8 cells' },
      mistakes: ['Mixing up chromatids and chromosomes'],
      memory_tip: 'PMAT: Please Make Another Twin',
      check: [{ q: 'First stage?', a: 'Prophase' }, { q: 'no answer' }],
    },
    { title: '', summary: 'dropped: no title' },
    {
      title: 'Meiosis',
      summary: 'Makes gametes.',
      key_terms: [{ term: 'chromatid', definition: 'duplicate, should not repeat in glossary' }, { term: 'Gamete', definition: 'Sex cell' }],
      example: null,
      check: [],
    },
  ],
  connections: ['Meiosis builds on mitosis'],
  exam_tips: ['"Describe" needs features, not reasons'],
  gaps: ['Notes mention cytokinesis but never explain it'],
  recall: [
    { q: 'What does PMAT stand for?', a: 'Prophase, metaphase, anaphase, telophase', topic: 'Mitosis' },
    { question: 'First stage?', answer: 'Prophase' },
  ],
};

// ------------------------------------------------------------ normalising

test('normaliseGuide keeps the good parts and drops the junk', () => {
  const g = sg.normaliseGuide(RAW);
  assert.equal(g.title, 'Cell division');
  assert.deepEqual(g.examinable, ['Describe the stages of mitosis', '42']);
  assert.equal(g.topics.length, 2, 'untitled topic dropped');
  const [mitosis, meiosis] = g.topics;
  assert.deepEqual(mitosis.key_points, ['PMAT order']);
  assert.equal(mitosis.key_terms.length, 1);
  assert.equal(mitosis.tables.length, 1, 'single-column table dropped');
  assert.deepEqual(mitosis.tables[0].rows[0], ['Daughter cells', '2', '4'], 'row trimmed to the columns');
  assert.equal(mitosis.example.steps.length, 2);
  assert.equal(mitosis.check.length, 1, 'check without an answer dropped');
  assert.equal(meiosis.example, null);
  assert.equal(meiosis.memory_tip, null);
  assert.equal(g.recall.length, 2, 'accepts question/answer as well as q/a');
});

test('normaliseGuide returns null when there is nothing to revise from', () => {
  assert.equal(sg.normaliseGuide(null), null);
  assert.equal(sg.normaliseGuide({ title: 'x', topics: [] }), null);
  assert.equal(sg.normaliseGuide({ topics: [{ summary: 'no title' }] }), null);
});

test('normaliseGuide falls back to the first topic for a missing title', () => {
  assert.equal(sg.normaliseGuide({ topics: [{ title: 'Forces' }] }).title, 'Forces');
});

// ------------------------------------------------------------ parsing

test('parseGuideJson reads fenced JSON', () => {
  const r = sg.parseGuideJson('```json\n{"title":"A","topics":[{"title":"B"}]}\n```');
  assert.equal(r.truncated, false);
  assert.equal(r.data.topics[0].title, 'B');
});

test('parseGuideJson rescues a guide cut off mid-way, keeping the complete topics', () => {
  const full = JSON.stringify(RAW);
  const cut = full.slice(0, full.indexOf('"title":"Meiosis"') + 25); // inside the third topic
  const r = sg.parseGuideJson(cut);
  assert.ok(r, 'repaired');
  assert.equal(r.truncated, true);
  const g = sg.normaliseGuide(r.data);
  assert.equal(g.topics[0].title, 'Mitosis');
  assert.equal(g.topics[0].check[0].a, 'Prophase');
});

test('repairJson handles braces and quotes inside strings', () => {
  const r = sg.repairJson('{"title":"a {tricky} \\"one\\"","topics":[{"title":"x [y]"},{"title":"cut');
  assert.equal(r.title, 'a {tricky} "one"');
  assert.deepEqual(r.topics, [{ title: 'x [y]' }]);
});

test('parseGuideJson gives up on text that is not JSON', () => {
  assert.equal(sg.parseGuideJson('# A markdown guide\n\nNo braces here'), null);
});

// ------------------------------------------------------------ outputs

test('guideToMarkdown includes every section', () => {
  const md = sg.guideToMarkdown(sg.normaliseGuide(RAW), { subject: 'Science' });
  for (const bit of [
    '# Cell division',
    '*Science*',
    "## What's examinable",
    '## 1. Mitosis',
    '**Key terms**',
    '- **Chromatid**: One copy of a replicated chromosome',
    '`2^n`',
    '| | Mitosis | Meiosis |'.replace('| |', '|  |'),
    '**Worked example**',
    '1. 2^3',
    '**Answer:** 8 cells',
    '**Common mistakes**',
    '**Memory tip:** PMAT',
    '## 2. Meiosis',
    '## How it connects',
    '## Exam tips',
    '## Check with your teacher',
    '## Quick recall',
  ]) {
    assert.ok(md.includes(bit), `missing: ${bit}`);
  }
});

test('glossary is A-Z and de-duplicated across topics', () => {
  const terms = sg.glossary(sg.normaliseGuide(RAW)).map((t) => t.term);
  assert.deepEqual(terms, ['Chromatid', 'Gamete']);
});

test('guideCards turns checks and recall into cards without repeats', () => {
  const cards = sg.guideCards(sg.normaliseGuide(RAW));
  assert.deepEqual(
    cards.map((c) => c.front),
    ['First stage?', 'What does PMAT stand for?'],
  );
  assert.equal(cards[0].topic, 'Mitosis');
});

test('guideStats counts topics, terms and questions', () => {
  const s = sg.guideStats(sg.normaliseGuide(RAW));
  assert.equal(s.topics, 2);
  assert.equal(s.terms, 2);
  assert.equal(s.questions, 3);
  assert.ok(s.minutes >= 1);
});

test('topicAnchor makes unique, link-safe ids', () => {
  assert.equal(sg.topicAnchor('Cell Division (Mitosis)', 0), 't1-cell-division-mitosis');
  assert.equal(sg.topicAnchor('???', 4), 't5-topic');
});

// ------------------------------------------------------------ generate route

test('studyGuideResult returns the guide plus markdown text for the Kindle', () => {
  const { status, body } = gen.studyGuideResult(JSON.stringify(RAW), { subject: 'Science', depth: 'concise' });
  assert.equal(status, 200);
  assert.equal(body.mode, 'study_guide');
  assert.equal(body.depth, 'concise');
  assert.equal(body.truncated, false);
  assert.equal(body.guide.topics.length, 2);
  assert.ok(body.text.startsWith('# Cell division'));
});

test('studyGuideResult flags a guide that hit the length limit', () => {
  const { body } = gen.studyGuideResult(JSON.stringify(RAW), { stopReason: 'max_tokens' });
  assert.equal(body.truncated, true);
});

test('studyGuideResult keeps a plain markdown reply, rejects garbled JSON', () => {
  const md = gen.studyGuideResult('# Forces\n\nA force is a push or a pull. Newton said lots about them.');
  assert.equal(md.status, 200);
  assert.equal(md.body.guide, undefined);
  assert.ok(md.body.text.startsWith('# Forces'));
  const bad = gen.studyGuideResult('{"title": "x", "topi');
  assert.equal(bad.status, 502);
});

test('generateStudyMaterial asks for a long JSON guide and sends the depth', async () => {
  const sent = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    sent.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(RAW) }], stop_reason: 'end_turn' }));
  };
  try {
    const full = await gen.generateStudyMaterial({ mode: 'study_guide', subject: 'Science', sourceText: 'x'.repeat(80) });
    assert.equal(full.status, 200);
    assert.equal(full.body.guide.title, 'Cell division');
    assert.equal(sent[0].max_tokens, 16000);
    assert.match(sent[0].system, /Length: FULL/);
    assert.match(sent[0].system, /"topics"/);

    await gen.generateStudyMaterial({ mode: 'study_guide', sourceText: 'x'.repeat(80), depth: 'concise', maxTokens: 6144 });
    assert.equal(sent[1].max_tokens, 6144, 'the Kindle keeps its own limit');
    assert.match(sent[1].system, /Length: CONCISE/);

    await gen.generateStudyMaterial({ mode: 'quiz', sourceText: 'x'.repeat(80) });
    assert.equal(sent[2].max_tokens, 8192, 'other modes unchanged');
    assert.doesNotMatch(sent[2].system, /Length:/);
  } finally {
    globalThis.fetch = realFetch;
  }
});

// ------------------------------------------------------------ coming up

test('subjectFromTag reads the command bar tags', () => {
  assert.equal(cu.subjectFromTag('School · Science'), 'Science');
  assert.equal(cu.subjectFromTag('School · Mathematics Advanced'), 'Mathematics Advanced');
  assert.equal(cu.subjectFromTag('General'), null);
  assert.equal(cu.subjectFromTag(null), null);
});

test('dueLabel reads naturally', () => {
  assert.equal(cu.dueLabel(0), 'Today');
  assert.equal(cu.dueLabel(1), 'Tomorrow');
  assert.equal(cu.dueLabel(5), 'In 5 days');
  assert.equal(cu.dueLabel(9), 'In 9 days');
  assert.equal(cu.dueLabel(14), 'In 2 weeks');
});

test('buildComingUp: open school items in the next four weeks, soonest first, tests before plan steps', () => {
  const today = '2026-10-15';
  const rows = [
    { id: 1, title: 'Review chapter 3', tag: 'School · Science', due_date: '2026-10-20', status: 'not_started' },
    { id: 2, title: 'Science test', tag: 'School · Science', due_date: '2026-10-20', status: 'not_started' },
    { id: 3, title: 'Done thing', tag: 'School · English', due_date: '2026-10-16', status: 'done' },
    { id: 4, title: 'Buy milk', tag: 'General', due_date: '2026-10-16', status: 'not_started' },
    { id: 5, title: 'History essay due', tag: 'School · History', due_date: '2026-10-17', status: 'not_started' },
    { id: 6, title: 'Far away', tag: 'School · French', due_date: '2026-12-30', status: 'not_started' },
    { id: 7, title: 'Past', tag: 'School · French', due_date: '2026-10-01', status: 'not_started' },
    { id: 8, title: 'No date', tag: 'School · French', due_date: null, status: 'not_started' },
  ];
  const out = cu.buildComingUp(rows, { today });
  assert.deepEqual(
    out.map((r) => r.id),
    [5, 2, 1],
  );
  assert.equal(out[0].label, 'In 2 days');
  assert.equal(out[0].subject, 'History');
  assert.equal(out[1].assessment, true);
  assert.equal(out[2].assessment, false);
});

test('only notifications filed under a subject count as study updates', () => {
  const rows = [
    { id: 1, subjects: ['General'], created_at: '2026-10-14T00:00:00Z' },
    { id: 2, subjects: ['Science', 'General'], created_at: '2026-10-13T00:00:00Z' },
    { id: 3, subjects: [], created_at: '2026-10-15T00:00:00Z' },
    { id: 4, subjects: ['English'], created_at: '2026-10-15T00:00:00Z' },
  ];
  const out = cu.studyNotifications(rows);
  assert.deepEqual(
    out.map((r) => r.id),
    [4, 2],
  );
  assert.deepEqual(out[1].subjects, ['Science']);
  assert.equal(cu.isStudyNotification({ subjects: null }), false);
});

// ------------------------------------------------------------ notes

test('guessTitle uses a heading-like first line, otherwise a dated name', () => {
  assert.equal(notes.guessTitle('# Photosynthesis\nLight reactions...'), 'Photosynthesis');
  assert.match(notes.guessTitle('Plants make food from light. They need water.', new Date('2026-10-15')), /^Notes, 15 Oct/);
  assert.match(notes.guessTitle(''), /^Notes, /);
});

test('searchNotes needs every word, across title, subject and text', () => {
  const list = [
    { id: 1, file_name: 'Cells', subject: 'Science', ocr_text: 'mitosis and meiosis' },
    { id: 2, file_name: 'WW1', subject: 'History', ocr_text: 'trenches, alliances' },
  ];
  assert.deepEqual(notes.searchNotes(list, 'science mitosis').map((n) => n.id), [1]);
  assert.deepEqual(notes.searchNotes(list, 'ALLIANCES').map((n) => n.id), [2]);
  assert.equal(notes.searchNotes(list, 'mitosis trenches').length, 0);
  assert.equal(notes.searchNotes(list, '  ').length, 2);
});

test('combineNotes joins one subject newest first under headings, capped', () => {
  const list = [
    { subject: 'Science', file_name: 'B', ocr_text: 'second' },
    { subject: 'History', file_name: 'H', ocr_text: 'nope' },
    { subject: 'Science', file_name: 'A', ocr_text: 'first' },
  ];
  assert.equal(notes.combineNotes(list, 'Science'), '# B\nsecond\n\n# A\nfirst');
  assert.equal(notes.combineNotes(list, 'Science', 5).length, 5);
});

test('numberNotes keeps doc_number when present, otherwise upload order', () => {
  const out = notes.numberNotes([
    { id: 'b', uploaded_at: '2026-10-02' },
    { id: 'a', uploaded_at: '2026-10-01' },
    { id: 'c', uploaded_at: '2026-10-03', doc_number: 9 },
  ]);
  assert.deepEqual(
    out.map((n) => [n.id, n.n]),
    [
      ['b', 2],
      ['a', 1],
      ['c', 9],
    ],
  );
});

// ------------------------------------------------------------ markdown

test('parseBlocks understands headings, lists, tables, code and paragraphs', () => {
  const blocks = parseBlocks(
    [
      '# Title',
      'A paragraph that',
      'wraps.',
      '',
      '- one',
      '- two',
      '  continued',
      '1. first',
      '2. second',
      '',
      '| A | B |',
      '| --- | --- |',
      '| 1 | 2 \\| 3 |',
      '',
      '```',
      'code here',
      '```',
      '---',
      '> quoted',
    ].join('\n'),
  );
  assert.deepEqual(
    blocks.map((b) => b.type),
    ['heading', 'p', 'ul', 'ol', 'table', 'code', 'rule', 'quote'],
  );
  assert.equal(blocks[1].text, 'A paragraph that wraps.');
  assert.deepEqual(blocks[2].items[1], { text: 'two', sub: ['continued'] });
  assert.deepEqual(blocks[4].rows[0], ['1', '2 | 3']);
  assert.equal(blocks[5].text, 'code here');
});

test('the markdown made from a guide parses back into sections', () => {
  const md = sg.guideToMarkdown(sg.normaliseGuide(RAW));
  const headings = parseBlocks(md)
    .filter((b) => b.type === 'heading')
    .map((b) => b.text);
  assert.deepEqual(headings.slice(0, 4), ['Cell division', "What's examinable", '1. Mitosis', '2. Meiosis']);
  assert.ok(parseBlocks(md).some((b) => b.type === 'table'));
});
