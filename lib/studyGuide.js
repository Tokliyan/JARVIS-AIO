// Studyboy study guides: paste your notes, get a guide you can actually revise
// from. Claude returns the guide as structured JSON so the page can lay it out
// properly (contents, key terms, formulas, step-by-step examples, tap-to-reveal
// checks, a self-test at the end). guideToMarkdown turns the same guide into
// plain markdown for copying, downloading, the Kindle and the command bar.
//
// Pure functions only (no fetch, no Supabase) so they can be unit tested.

export const GUIDE_DEPTHS = {
  concise: `Length: CONCISE. A tight one-sitting revision sheet. At most 6 topics (merge small ones). Per topic: 2-4 key points, only the key terms that matter, at most one check question. 8-10 quick recall questions.`,
  full: `Length: FULL. Cover every topic in the material, nothing skipped. Per topic: as many key points, terms and formulas as the material supports, a worked example wherever a calculation, process or extended answer is examinable, and 2-3 check questions. 12-20 quick recall questions spread across all topics.`,
};

export function guidePrompt(nesaContext) {
  return `You turn a student's own notes into a study guide they can revise from. It must read like the best set of revision notes in the class: clear, organised, nothing important missing, nothing padded.

${nesaContext}

How to build it:
- Work out what is actually examinable in the notes and organise the guide around those topics, in a sensible teaching order (foundations first), not just the order the notes happen to be in.
- Explain each idea in plain English a Year 10 student understands on first read, then give the precise wording they should use in an exam.
- Key terms: the exact definitions a marker expects. Formulas: write them in plain text (e.g. "v = u + at"), say what every symbol means and when to use it.
- Worked example: a realistic exam-style question with numbered steps and the final answer. Only where the topic has something to work through (calculations, processes, source analysis, extended response structure). Use null otherwise.
- Common mistakes: the specific errors students make on this topic and how to avoid them.
- Memory tip: a short mnemonic, analogy or link that genuinely helps. Use null rather than forcing one.
- Comparison table: only where two or more things are naturally compared (e.g. mitosis vs meiosis). Otherwise an empty list.
- Check questions: short questions on that topic with brief answers, to test straight after reading it.
- Connections: how the topics link to each other.
- Exam tips: how this content gets examined, using the NESA directive verbs.
- Gaps: things the notes mention but don't explain well enough to revise from, phrased as something to ask the teacher or look up. Empty list if none.
- Quick recall: a final self-test across all topics, each with a short answer and the topic it belongs to.

Respond with ONLY a JSON object, no markdown fences, no commentary, in exactly this shape:
{
  "title": "short title for the guide",
  "overview": "2-3 sentences: what this unit is about and why it matters",
  "examinable": ["what you need to be able to do, one line each"],
  "topics": [
    {
      "title": "topic name",
      "summary": "plain-English explanation, 2-5 sentences",
      "key_points": ["the things to remember"],
      "key_terms": [{ "term": "...", "definition": "..." }],
      "formulas": [{ "name": "...", "expression": "...", "meaning": "what each symbol means and when to use it" }],
      "tables": [{ "title": "...", "columns": ["...", "..."], "rows": [["...", "..."]] }],
      "example": { "prompt": "exam-style question", "steps": ["step 1", "step 2"], "answer": "final answer" },
      "mistakes": ["..."],
      "memory_tip": "..." ,
      "check": [{ "q": "...", "a": "..." }]
    }
  ],
  "connections": ["..."],
  "exam_tips": ["..."],
  "gaps": ["..."],
  "recall": [{ "q": "...", "a": "...", "topic": "topic title" }]
}`;
}

// ---------------------------------------------------------------------------
// Parsing. A long guide can hit the output limit and arrive cut off mid-way;
// rather than throwing the whole thing away, keep everything up to the last
// complete piece and close the brackets.

function stripFences(text) {
  const s = String(text || '').replace(/```json|```/g, '').trim();
  const start = s.indexOf('{');
  return start === -1 ? s : s.slice(start);
}

export function repairJson(text) {
  const s = stripFences(text);
  const stack = [];
  const cuts = [];
  let inString = false;
  let escaped = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === '{' || c === '[') stack.push(c);
    else if (c === '}' || c === ']') {
      stack.pop();
      cuts.push([i + 1, stack.slice()]);
    }
  }
  for (let k = cuts.length - 1; k >= 0 && k >= cuts.length - 400; k--) {
    const [pos, open] = cuts[k];
    const prefix = s.slice(0, pos).replace(/,\s*$/, '');
    const closers = open
      .slice()
      .reverse()
      .map((c) => (c === '{' ? '}' : ']'))
      .join('');
    try {
      return JSON.parse(prefix + closers);
    } catch {
      // try an earlier cut
    }
  }
  return null;
}

/** Parses Claude's reply. Returns { data, truncated } or null. */
export function parseGuideJson(text) {
  const s = stripFences(text);
  try {
    return { data: JSON.parse(s), truncated: false };
  } catch {
    const data = repairJson(s);
    return data ? { data, truncated: true } : null;
  }
}

// ---------------------------------------------------------------------------
// Normalising: whatever comes back, the page only ever sees clean, capped
// fields of the right type.

const str = (v, max = 2000) => (typeof v === 'string' || typeof v === 'number' ? String(v).trim().slice(0, max) : '');
const list = (v, max = 40) => (Array.isArray(v) ? v.slice(0, max) : []);
const strings = (v, max = 40, len = 600) => list(v, max).map((x) => str(x, len)).filter(Boolean);
const qa = (v, max = 30) =>
  list(v, max)
    .map((x) => ({ q: str(x?.q ?? x?.question, 600), a: str(x?.a ?? x?.answer, 1200), topic: str(x?.topic, 160) }))
    .filter((x) => x.q && x.a);

function normaliseTopic(t) {
  if (!t || typeof t !== 'object') return null;
  const title = str(t.title, 160);
  if (!title) return null;

  const ex = t.example && typeof t.example === 'object' ? t.example : null;
  const example =
    ex && str(ex.prompt, 1500)
      ? { prompt: str(ex.prompt, 1500), steps: strings(ex.steps, 15, 800), answer: str(ex.answer, 800) }
      : null;

  const tables = list(t.tables, 4)
    .map((tb) => {
      const columns = list(tb?.columns, 6).map((c) => str(c, 120));
      if (!columns.some(Boolean)) return null;
      const rows = list(tb?.rows, 20)
        .map((r) => list(r, columns.length).map((c) => str(c, 400)))
        .filter((r) => r.some(Boolean))
        .map((r) => columns.map((_, i) => r[i] || ''));
      return columns.length >= 2 && rows.length ? { title: str(tb?.title, 160), columns, rows } : null;
    })
    .filter(Boolean);

  return {
    title,
    summary: str(t.summary, 3000),
    key_points: strings(t.key_points, 20),
    key_terms: list(t.key_terms, 30)
      .map((k) => ({ term: str(k?.term, 160), definition: str(k?.definition, 800) }))
      .filter((k) => k.term && k.definition),
    formulas: list(t.formulas, 15)
      .map((f) => ({ name: str(f?.name, 160), expression: str(f?.expression, 300), meaning: str(f?.meaning, 800) }))
      .filter((f) => f.expression),
    tables,
    example,
    mistakes: strings(t.mistakes, 10),
    memory_tip: str(t.memory_tip, 600) || null,
    check: qa(t.check, 5),
  };
}

/** Returns a clean guide, or null when there's nothing usable in it. */
export function normaliseGuide(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const topics = list(raw.topics, 25).map(normaliseTopic).filter(Boolean);
  if (topics.length === 0) return null;
  return {
    title: str(raw.title, 160) || topics[0].title,
    overview: str(raw.overview, 1500),
    examinable: strings(raw.examinable, 20),
    topics,
    connections: strings(raw.connections, 10),
    exam_tips: strings(raw.exam_tips, 12),
    gaps: strings(raw.gaps, 10),
    recall: qa(raw.recall, 30),
  };
}

// ---------------------------------------------------------------------------

/** Every key term in the guide, A-Z, without duplicates. */
export function glossary(guide) {
  const seen = new Map();
  for (const t of guide?.topics || []) {
    for (const k of t.key_terms) {
      const key = k.term.toLowerCase();
      if (!seen.has(key)) seen.set(key, { ...k, topic: t.title });
    }
  }
  return [...seen.values()].sort((a, b) => a.term.localeCompare(b.term));
}

export function guideStats(guide) {
  const topics = guide?.topics || [];
  const md = guideToMarkdown(guide);
  const words = md.split(/\s+/).filter(Boolean).length;
  return {
    topics: topics.length,
    terms: glossary(guide).length,
    questions: topics.reduce((n, t) => n + t.check.length, 0) + (guide?.recall?.length || 0),
    minutes: Math.max(1, Math.round(words / 200)),
  };
}

/** Slug for in-page links: "Cell Division (Mitosis)" -> "cell-division-mitosis". */
export function topicAnchor(title, i) {
  const slug = String(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `t${i + 1}-${slug || 'topic'}`;
}

function mdCell(s) {
  return String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

export function guideToMarkdown(guide, { subject } = {}) {
  if (!guide) return '';
  const out = [];
  out.push(`# ${guide.title}`);
  if (subject) out.push(`*${subject}*`);
  if (guide.overview) out.push('', guide.overview);

  if (guide.examinable.length) {
    out.push('', "## What's examinable");
    guide.examinable.forEach((e) => out.push(`- ${e}`));
  }

  guide.topics.forEach((t, i) => {
    out.push('', `## ${i + 1}. ${t.title}`);
    if (t.summary) out.push('', t.summary);
    if (t.key_points.length) {
      out.push('', '**Key points**');
      t.key_points.forEach((p) => out.push(`- ${p}`));
    }
    if (t.key_terms.length) {
      out.push('', '**Key terms**');
      t.key_terms.forEach((k) => out.push(`- **${k.term}**: ${k.definition}`));
    }
    if (t.formulas.length) {
      out.push('', '**Formulas**');
      t.formulas.forEach((f) =>
        out.push(`- ${f.name ? `${f.name}: ` : ''}\`${f.expression}\`${f.meaning ? `. ${f.meaning}` : ''}`),
      );
    }
    t.tables.forEach((tb) => {
      out.push('');
      if (tb.title) out.push(`**${tb.title}**`, '');
      out.push(`| ${tb.columns.map(mdCell).join(' | ')} |`);
      out.push(`| ${tb.columns.map(() => '---').join(' | ')} |`);
      tb.rows.forEach((r) => out.push(`| ${r.map(mdCell).join(' | ')} |`));
    });
    if (t.example) {
      out.push('', '**Worked example**', '', t.example.prompt);
      t.example.steps.forEach((s, n) => out.push(`${n + 1}. ${s}`));
      if (t.example.answer) out.push('', `**Answer:** ${t.example.answer}`);
    }
    if (t.mistakes.length) {
      out.push('', '**Common mistakes**');
      t.mistakes.forEach((m) => out.push(`- ${m}`));
    }
    if (t.memory_tip) out.push('', `**Memory tip:** ${t.memory_tip}`);
    if (t.check.length) {
      out.push('', '**Check yourself**');
      t.check.forEach((c) => out.push(`- ${c.q} *${c.a}*`));
    }
  });

  if (guide.connections.length) {
    out.push('', '## How it connects');
    guide.connections.forEach((c) => out.push(`- ${c}`));
  }
  if (guide.exam_tips.length) {
    out.push('', '## Exam tips');
    guide.exam_tips.forEach((c) => out.push(`- ${c}`));
  }
  if (guide.gaps.length) {
    out.push('', '## Check with your teacher');
    guide.gaps.forEach((c) => out.push(`- ${c}`));
  }
  if (guide.recall.length) {
    out.push('', '## Quick recall');
    guide.recall.forEach((r, n) => out.push(`${n + 1}. ${r.q}`, `   *${r.a}*`));
  }
  return out.join('\n').trim() + '\n';
}

/** Recall + check questions as review-deck cards. */
export function guideCards(guide) {
  const cards = [];
  for (const t of guide?.topics || []) {
    for (const c of t.check) cards.push({ topic: t.title, front: c.q, back: c.a });
  }
  for (const r of guide?.recall || []) cards.push({ topic: r.topic || null, front: r.q, back: r.a });
  const seen = new Set();
  return cards.filter((c) => {
    const k = c.front.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
