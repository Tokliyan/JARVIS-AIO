import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { state, resetState, supabaseAdmin } from './fakeSupabaseAdmin.mjs';

process.env.KINDLE_COMMAND_TOKEN = 'kindle-secret';
process.env.NIGHT_RUN_TOKEN = 'night-secret';

const pages = await import('../lib/kindlePages.js');
const { default: handler } = await import('../pages/api/kindle/page.js');
const { default: queue } = await import('../pages/api/nightrun/queue.js');

const OWNER = '04b4fa14-b541-4b23-92d6-886d6202d727';
const NOW = new Date('2026-11-24T00:30:00Z'); // Tue 24 Nov, Sydney morning
const TODAY = '2026-11-24';

const rss = (n, label) =>
  `<rss><channel>${Array.from({ length: n }, (_, i) => `<item><title><![CDATA[${label} story ${i + 1} &amp; more]]></title><link>https://www.abc.net.au/news/${label}-${i + 1}</link><description>Summary &lt;b&gt;${i + 1}&lt;/b&gt;</description><pubDate>Tue, 24 Nov 2026 09:00:00 +1100</pubDate></item>`).join('')}</channel></rss>`;

const ARTICLE_HTML = `<html><body><nav><p>Menu junk that is long enough to be a paragraph but is inside nav</p></nav><article>
<p>First paragraph of the story, long enough to keep. It has two sentences.</p>
<p>Share this article with your friends and family today please</p>
<p>Second paragraph of the story, also long enough to be kept as text here.</p>
<p>Second paragraph of the story, also long enough to be kept as text here.</p></article></body></html>`;

const WEATHER = (rainAt = {}) => {
  const time = [];
  const temp = [];
  const rain = [];
  for (let d = 0; d < 2; d++) for (let h = 0; h < 24; h++) {
    time.push(`2026-11-${24 + d}T${String(h).padStart(2, '0')}:00`);
    temp.push(14 + (h % 12));
    rain.push(d === 0 ? rainAt[h] ?? 5 : 5);
  }
  return {
    current: { time: '2026-11-24T10:30', temperature_2m: 19.4, apparent_temperature: 18.2, weather_code: 2, wind_speed_10m: 12.2, wind_direction_10m: 45 },
    hourly: { time, temperature_2m: temp, precipitation_probability: rain },
    daily: {
      time: ['2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28'],
      weather_code: [2, 61, 0, 2, 95],
      temperature_2m_max: [24, 22, 26, 25, 23],
      temperature_2m_min: [15, 14, 16, 15, 14],
      precipitation_probability_max: [20, 70, 0, 10, 80],
      sunrise: ['2026-11-24T05:47'],
      sunset: ['2026-11-24T19:52'],
      uv_index_max: [9.4],
    },
  };
};

function fakeFetch({ fail = false, rainAt, articleFail = false } = {}) {
  return async (url) => {
    const u = String(url);
    if (fail) throw new Error('offline');
    if (u.includes('open-meteo')) return { ok: true, json: async () => WEATHER(rainAt) };
    if (u.includes('104217374')) return { ok: true, text: async () => rss(3, 'money') };
    if (u.includes('104217372')) return { ok: true, text: async () => rss(3, 'politics') };
    if (u.includes('yahoo')) return { ok: true, json: async () => ({ chart: { result: [{ meta: { regularMarketPrice: 8412.3, chartPreviousClose: 8380 } }] } }) };
    if (u.includes('frankfurter')) return { ok: true, json: async () => ({ rates: { '2026-11-20': { USD: 0.652 }, '2026-11-23': { USD: 0.651 } } }) };
    if (u.includes('coingecko')) return { ok: true, json: async () => ({ bitcoin: { aud: 97400, aud_24h_change: 1.8 }, ethereum: { aud: 3500, aud_24h_change: -0.6 } }) };
    if (u.includes('abc.net.au/news/')) {
      if (articleFail) return { ok: false, status: 500 };
      return { ok: true, text: async () => ARTICLE_HTML };
    }
    throw new Error(`unexpected url ${u}`);
  };
}

function call(query = {}, token = 'kindle-secret', method = 'GET') {
  const req = { method, headers: token ? { authorization: `Bearer ${token}` } : {}, query };
  const res = {
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    status(c) { this.code = c; return this; },
    json(b) { this.body = b; return this; },
    send(b) { this.body = b; return this; },
  };
  return handler(req, res).then(() => res);
}

const manyDone = Array.from({ length: 12 }, (_, i) => ({ title: `Finished thing ${i + 1}`, status: 'done', done_at: i < 4 ? TODAY : '2026-11-22' }));

beforeEach(() => {
  pages._clearCache();
  resetState({
    aio_settings: [{ user_id: OWNER, key: 'current_week', value: 'B' }],
    aio_timetable: [],
    aio_checklist: [{ user_id: OWNER, title: 'Hand in essay', status: 'todo', due_date: TODAY }],
    aio_projects: [
      {
        id: 'p1', user_id: OWNER, name: 'Rade.XT', status_label: 'Paper trading', status_color: 'warn', last_update: 'Running on paper trades.',
        roadmap: [
          { title: 'Tighten stop-loss rule', status: 'in_progress', steps: [{ title: 'Write the rule', done: true }, { title: 'Add tests', done: false }] },
          { title: 'Backtest 90 days', status: 'planned', estimate: '~2 hrs', blocked: 'needs data' },
          { title: 'Weekly summary', status: 'planned' },
          { title: 'Risk limits', status: 'done', done_at: '2026-11-21' },
        ],
        notes: [{ heading: 'Why paper first', body: 'Prove it before real money.' }],
      },
      { id: 'p2', user_id: OWNER, name: 'RuneHaven', status_label: 'Building', status_color: 'good', roadmap: manyDone, notes: [] },
      { id: 'p3', user_id: OWNER, name: 'Fish-Z', status_color: 'idle', roadmap: [] },
    ],
    aio_night_runs: [
      { user_id: OWNER, run_date: TODAY, section: 'rade', status: 'ok', summary: 'Nightly run ok.', needs_you: ['Review paper-trade results'], details: { built: ['Added retry', 'Risk limits'], pending_sql: [] }, created_at: '2026-11-24T05:00:00Z' },
      { user_id: OWNER, run_date: '2026-11-23', section: 'rade', status: 'warn', summary: 'One exchange error.', needs_you: [], details: { built: ['Paper mode'] }, created_at: '2026-11-23T05:00:00Z' },
    ],
  });
});

// ---------------------------------------------------------------- parsers

test('RSS: decodes CDATA and entities, stable ids, relative age', () => {
  const items = pages.parseRss(rss(2, 'money'));
  assert.equal(items[0].title, 'money story 1 & more');
  assert.equal(items[0].summary, 'Summary 1');
  assert.equal(items[0].id, pages.storyId(items[0].link));
  assert.equal(pages.ago('Tue, 24 Nov 2026 09:00:00 +1100', new Date('2026-11-24T00:00:00Z')), '2h');
  assert.deepEqual(pages.parseRss('nope'), []);
});

test('article text: keeps story paragraphs, drops menus, share lines and repeats', () => {
  const paras = pages.extractParagraphs(ARTICLE_HTML);
  assert.equal(paras.length, 2);
  assert.match(paras[0], /^First paragraph/);
  const chunks = pages.chunkParagraphs(['One sentence here. '.repeat(40).trim()], 200);
  assert.ok(chunks.length > 3 && chunks.every((c) => c.length <= 200));
});

test('weather: umbrella advice from the hours, wind direction, UV', () => {
  const dry = pages.parseWeather(WEATHER());
  const a = pages.umbrellaAdvice(dry);
  assert.equal(a.title, 'Umbrella: not needed');
  assert.match(a.line1, /Dry for school/);
  assert.match(a.line2, /Leave 8:00am/);
  assert.equal(dry.windDir, 'NE');
  assert.equal(dry.uv, 9);
  const wet = pages.umbrellaAdvice(pages.parseWeather(WEATHER({ 11: 70 })));
  assert.equal(wet.title, 'Umbrella: take one');
  assert.match(wet.line1, /11am \(70%\)/);
  assert.match(wet.line1, /Wet during school/);
  assert.equal(pages.parseWeather({}), null);
});

test('markets: each source parsed, one failing source shows a dash, all failing is null', async () => {
  const m = await pages.getMarkets(fakeFetch());
  assert.deepEqual(m.map((x) => x.label), ['ASX 200', 'AUD/USD', 'Bitcoin', 'Ethereum']);
  assert.equal(m[0].value, '8,412');
  assert.equal(m[0].dir, 1);
  assert.equal(m[1].dir, -1);
  assert.equal(m[2].value, '$97.4k');
  assert.equal(m[3].dir, -1);
  pages._clearCache();
  const partial = await pages.getMarkets(async (u) => {
    if (String(u).includes('yahoo')) throw new Error('down');
    return fakeFetch()(u);
  });
  assert.equal(partial[0].value, '—');
  assert.equal(partial[2].value, '$97.4k');
  pages._clearCache();
  assert.equal(await pages.getMarkets(fakeFetch({ fail: true })), null);
});

test('news: three money and three politics stories, tagged; fails soft and serves stale', async () => {
  const n = await pages.getNews(fakeFetch());
  assert.deepEqual(n.map((x) => x.tag), ['MONEY', 'MONEY', 'MONEY', 'POLITICS', 'POLITICS', 'POLITICS']);
  const again = await pages.getNews(fakeFetch({ fail: true }));
  assert.equal(again.length, 6);
  pages._clearCache();
  assert.equal(await pages.getNews(fakeFetch({ fail: true })), null);
});

test('articles only fetch from abc.net.au', async () => {
  let called = false;
  const spy = async () => { called = true; return { ok: true, text: async () => ARTICLE_HTML }; };
  assert.equal(await pages.getArticle('https://evil.example.com/x', spy), null);
  assert.equal(called, false);
  assert.equal(await pages.getArticle('https://www.abc.net.au.evil.com/x', spy), null);
  assert.equal((await pages.getArticle('https://www.abc.net.au/news/x', spy)).paras.length, 2);
});

// ----------------------------------------------------------------- scenes

const db = () => supabaseAdmin();
const scene = (q) => pages.buildScene(q, { db: db(), fetchImpl: fakeFetch(), now: NOW });

test('story scene: article body, summary fallback and unknown story', async () => {
  const news = await pages.getNews(fakeFetch());
  const id = news[0].id;
  const ok = await scene({ page: 'article', id });
  assert.equal(ok.blocks.filter((b) => b.t === 'para').length, 2);
  assert.equal(ok.nav, 'news');
  assert.equal(ok.edgeTap, true);

  pages._clearCache();
  const fb = await pages.buildScene({ page: 'article', id }, { db: db(), fetchImpl: fakeFetch({ articleFail: true }), now: NOW });
  assert.match(JSON.stringify(fb.blocks), /Full story unavailable/);
  assert.match(JSON.stringify(fb.blocks), /Summary 1/);

  const missing = await scene({ page: 'article', id: 'nope' });
  assert.match(JSON.stringify(missing.blocks), /Story not found/);
});

test('projects list: progress, done and next lines, needs-you first', async () => {
  const s = await scene({ page: 'projects' });
  const cards = s.blocks.filter((b) => b.t === 'project');
  assert.deepEqual(cards.map((c) => c.name), ['Rade.XT', 'Fish-Z', 'RuneHaven']);
  const rade = cards[0];
  assert.equal(rade.pill, 'NEEDS YOU');
  assert.equal(rade.done, 1);
  assert.equal(rade.total, 4);
  assert.match(rade.nextLine, /Tighten stop-loss/);
  assert.match(rade.doneLine, /today|Tue/);
  assert.equal(cards[1].nextLine, 'Nothing queued');
});

test('project tabs: next, done, nights, notes', async () => {
  const next = await scene({ page: 'project', id: 'p1', tab: 'next' });
  const t = JSON.stringify(next.blocks);
  assert.match(t, /Review paper-trade results/); // needs you
  assert.match(t, /1 of 2|Write the rule/);
  assert.match(t, /Backtest 90 days/);
  assert.match(t, /BLOCKED: needs data/);
  assert.match(t, /Pending SQL: none/);
  const tabs = next.blocks.find((b) => b.t === 'tabs');
  assert.deepEqual(tabs.items.map((i) => i.count), [3, 3, 2, 1]); // 3 open; 3 done (risk limits, retry, paper mode: duplicates merged); nights 2; notes 1

  const done = await scene({ page: 'project', id: 'p1', tab: 'done' });
  const doneText = JSON.stringify(done.blocks);
  assert.match(doneText, /TODAY/);
  assert.equal((doneText.match(/Risk limits/g) || []).length, 1); // roadmap + night report deduped

  const nights = await scene({ page: 'project', id: 'p1', tab: 'nights' });
  assert.equal(nights.blocks.filter((b) => b.t === 'nightRow').length, 2);
  assert.match(JSON.stringify(nights.blocks), /LOOK/);

  const notes = await scene({ page: 'project', id: 'p1', tab: 'notes' });
  assert.match(JSON.stringify(notes.blocks), /Why paper first/);

  const missing = await scene({ page: 'project', id: 'zzz' });
  assert.match(JSON.stringify(missing.blocks), /no longer exists/);
});

// ------------------------------------------------------------------ route

test('route rejects a missing or wrong token and a non-GET', async () => {
  assert.equal((await call({}, null)).code, 401);
  assert.equal((await call({}, 'wrong')).code, 401);
  assert.equal((await call({}, 'kindle-secret', 'POST')).code, 405);
});

test('route renders every page as a PNG with in-bounds tap zones', async () => {
  const real = globalThis.fetch;
  globalThis.fetch = fakeFetch();
  try {
    const news = await pages.getNews(fakeFetch());
    const cases = [
      { p: 'home' }, { p: 'weather' }, { p: 'news' }, { p: 'projects' },
      { p: 'article', id: news[0].id },
      { p: 'project', id: 'p1', tab: 'next' }, { p: 'project', id: 'p1', tab: 'done' },
      { p: 'project', id: 'p1', tab: 'nights' }, { p: 'project', id: 'p1', tab: 'notes' },
    ];
    for (const q of cases) {
      const res = await call({ ...q, w: '600', h: '800' });
      assert.equal(res.code, 200, JSON.stringify(q));
      assert.equal(res.headers['Content-Type'], 'image/png');
      assert.equal(res.body.subarray(1, 4).toString(), 'PNG');
      const zones = JSON.parse(res.headers['X-Kindle-Zones']);
      for (const g of ['close', 'home', 'weather', 'projects', 'news']) assert.ok(zones.some((z) => z.go === g), `${JSON.stringify(q)} has ${g}`);
      for (const z of zones) assert.ok(z.x >= 0 && z.y >= 0 && z.x + z.w <= 1.001 && z.y + z.h <= 1.001, `${JSON.stringify(q)} zone in bounds`);
    }
  } finally {
    globalThis.fetch = real;
  }
});

test('news list taps open stories; projects list taps open projects; tabs switch tab', async () => {
  const real = globalThis.fetch;
  globalThis.fetch = fakeFetch();
  try {
    const news = JSON.parse((await call({ p: 'news' })).headers['X-Kindle-Zones']).filter((z) => z.go === 'article');
    assert.equal(news.length, 6);
    assert.ok(news.every((z) => z.id));
    const list = JSON.parse((await call({ p: 'projects' })).headers['X-Kindle-Zones']).filter((z) => z.go === 'project');
    assert.deepEqual(list.map((z) => z.id).sort(), ['p1', 'p2', 'p3']);
    const detail = JSON.parse((await call({ p: 'project', id: 'p1' })).headers['X-Kindle-Zones']);
    assert.deepEqual(detail.filter((z) => z.go === 'project' && z.tab).map((z) => z.tab), ['next', 'done', 'nights', 'notes']);
    assert.ok(detail.some((z) => z.go === 'projects' && z.y < 0.15), 'back button at the top');
  } finally {
    globalThis.fetch = real;
  }
});

test('long lists split into pages with Prev / Next zones and swipes', async () => {
  const first = await call({ p: 'project', id: 'p2', tab: 'done', w: '600', h: '800' });
  const total = Number(first.headers['X-Kindle-Pages']);
  assert.ok(total > 1, 'twelve done items need more than one page at this size');
  const z1 = JSON.parse(first.headers['X-Kindle-Zones']);
  const next = z1.find((z) => z.pg === 1 && !z.swipe);
  assert.equal(next.go, 'project');
  assert.equal(next.tab, 'done');
  assert.ok(z1.some((z) => z.swipe === 'west' && z.pg === 1));
  assert.ok(!z1.some((z) => z.swipe === 'east'));

  const second = await call({ p: 'project', id: 'p2', tab: 'done', pg: '1', w: '600', h: '800' });
  const z2 = JSON.parse(second.headers['X-Kindle-Zones']);
  assert.ok(z2.some((z) => z.pg === 0 && !z.swipe), 'Prev on page 2');
  assert.ok(z2.some((z) => z.go === 'project' && z.tab && !z.pg), 'tabs repeat on every page');
  const beyond = await call({ p: 'project', id: 'p2', tab: 'done', pg: '50', w: '600', h: '800' });
  assert.equal(beyond.code, 200); // clamped to the last page
});

test('pages still render when weather, markets and news are all unreachable', async () => {
  const real = globalThis.fetch;
  globalThis.fetch = fakeFetch({ fail: true });
  try {
    for (const p of ['home', 'weather', 'news']) {
      const res = await call({ p });
      assert.equal(res.code, 200, p);
      assert.equal(res.body.subarray(1, 4).toString(), 'PNG');
    }
  } finally {
    globalThis.fetch = real;
  }
});

test('zonesHeader is plain ASCII', () => {
  const h = pages.zonesHeader([{ go: 'project', id: 'café' }]);
  assert.match(h, /^[\x20-\x7e]*$/);
  assert.equal(JSON.parse(h)[0].id, 'café');
});

// ------------------------------------------------------- roadmap dates

test('marking a roadmap item done or in progress records the date', async () => {
  const post = async (title, status) => {
    const req = { method: 'POST', headers: { authorization: 'Bearer night-secret' }, body: { project_id: 'p1', title, status }, query: {} };
    const res = { status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; }, setHeader() {} };
    await queue(req, res);
    return res;
  };
  assert.equal((await post('Weekly summary', 'done')).code, 200);
  assert.equal((await post('Backtest 90 days', 'in_progress')).code, 200);
  const items = state.tables.aio_projects.find((p) => p.id === 'p1').roadmap;
  assert.match(items.find((i) => i.title === 'Weekly summary').done_at, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(items.find((i) => i.title === 'Backtest 90 days').started_at, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(items.find((i) => i.title === 'Weekly summary').status, 'done');
});
