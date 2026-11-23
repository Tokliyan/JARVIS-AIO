import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { resetState, supabaseAdmin } from './fakeSupabaseAdmin.mjs';

process.env.KINDLE_COMMAND_TOKEN = 'kindle-secret';

const pages = await import('../lib/kindlePages.js');
const { default: handler } = await import('../pages/api/kindle/page.js');

const OWNER = '04b4fa14-b541-4b23-92d6-886d6202d727';

const RSS = `<?xml version="1.0"?><rss><channel>
<item><title><![CDATA[Rain &amp; wind hit Sydney]]></title><description>Storms &lt;b&gt;expected&lt;/b&gt; tonight</description><pubDate>Mon, 23 Nov 2026 10:00:00 +1100</pubDate></item>
<item><title>Second story</title><description></description></item>
</channel></rss>`;

const WEATHER = {
  current: { time: '2026-11-23T22:00', temperature_2m: 21.4, apparent_temperature: 20.1, weather_code: 3, wind_speed_10m: 12.2 },
  hourly: {
    time: Array.from({ length: 24 }, (_, i) => `2026-11-23T${String(i).padStart(2, '0')}:00`),
    temperature_2m: Array.from({ length: 24 }, (_, i) => 15 + (i % 5)),
    precipitation_probability: Array.from({ length: 24 }, () => 10),
  },
  daily: {
    time: ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27'],
    weather_code: [3, 61, 0, 2, 95],
    temperature_2m_max: [24, 22, 26, 25, 23],
    temperature_2m_min: [15, 14, 16, 15, 14],
    precipitation_probability_max: [20, 70, 0, 10, 80],
  },
};

function fakeFetch({ fail = false } = {}) {
  return async (url) => {
    if (fail) throw new Error('offline');
    if (String(url).includes('open-meteo')) return { ok: true, json: async () => WEATHER };
    return { ok: true, text: async () => RSS };
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

beforeEach(() => {
  pages._clearCache();
  resetState({
    aio_settings: [{ user_id: OWNER, key: 'current_week', value: 'B' }],
    aio_timetable: [],
    aio_checklist: [{ user_id: OWNER, title: 'Hand in essay', status: 'todo', due_date: '2099-01-01' }],
    aio_projects: [
      { id: 'p1', user_id: OWNER, name: 'RuneHaven', status_label: 'Building', status_color: 'good', roadmap: [{ title: 'Fix terrain', status: 'planned' }, { title: 'Old thing', status: 'done' }], last_update: 'Terrain pass done.' },
      { id: 'p2', user_id: OWNER, name: 'Rade.XT', status_label: 'Needs a look', status_color: 'warn', roadmap: [] },
    ],
    aio_night_runs: [
      { user_id: OWNER, run_date: '2026-11-23', section: 'runehaven', status: 'ok', summary: 'Built 2 things.', needs_you: ['Run the SQL'], created_at: '2026-11-23T05:00:00Z' },
    ],
  });
});

test('parseRss decodes entities and CDATA and skips empty titles', () => {
  const items = pages.parseRss(RSS);
  assert.equal(items.length, 2);
  assert.equal(items[0].title, 'Rain & wind hit Sydney');
  assert.equal(items[0].summary, 'Storms expected tonight');
  assert.deepEqual(pages.parseRss('not xml'), []);
});

test('parseWeather shapes current, hours and days', () => {
  const w = pages.parseWeather(WEATHER);
  assert.equal(w.temp, 21);
  assert.equal(w.days.length, 5);
  assert.ok(w.hours.length > 0 && w.hours.length <= 8);
  assert.equal(pages.parseWeather({}), null);
  assert.equal(pages.weatherText(95), 'Thunderstorm');
  assert.equal(pages.weatherText(1234), 'Unknown');
});

test('weather and news fail soft and serve stale data when the network drops', async () => {
  assert.equal(await pages.getWeather(fakeFetch({ fail: true })), null);
  assert.equal(await pages.getNews(fakeFetch({ fail: true })), null);
  const ok = await pages.getNews(fakeFetch());
  assert.equal(ok[0].title, 'Rain & wind hit Sydney');
  // Cached: a failing network afterwards still returns the same news.
  const again = await pages.getNews(fakeFetch({ fail: true }));
  assert.equal(again[0].title, ok[0].title);
});

test('project scenes: list, detail and unknown id', async () => {
  const db = supabaseAdmin();
  const list = await pages.buildScene({ page: 'projects' }, { db, fetchImpl: fakeFetch() });
  const cards = list.blocks.filter((b) => b.t === 'card');
  assert.deepEqual(cards.map((c) => c.title), ['Rade.XT', 'RuneHaven']); // warn sorts before good
  assert.equal(cards[1].id, 'p1');

  const detail = await pages.buildScene({ page: 'project', id: 'p1' }, { db, fetchImpl: fakeFetch() });
  const text = JSON.stringify(detail.blocks);
  assert.match(text, /Terrain pass done/);
  assert.match(text, /Fix terrain/);
  assert.doesNotMatch(text, /Old thing/); // done items are hidden
  assert.match(text, /Run the SQL/); // last night's needs-you shows
  assert.equal(detail.page, 'projects');

  const missing = await pages.buildScene({ page: 'project', id: 'nope' }, { db, fetchImpl: fakeFetch() });
  assert.match(JSON.stringify(missing.blocks), /no longer exists/);
});

test('route rejects a missing or wrong token and a non-GET', async () => {
  assert.equal((await call({}, null)).code, 401);
  assert.equal((await call({}, 'wrong')).code, 401);
  assert.equal((await call({}, 'kindle-secret', 'POST')).code, 405);
});

test('route returns a PNG with tap zones for every page', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = fakeFetch();
  try {
    for (const p of ['home', 'weather', 'projects', 'news']) {
      const res = await call({ p, w: '600', h: '800' });
      assert.equal(res.code, 200, p);
      assert.equal(res.headers['Content-Type'], 'image/png');
      assert.equal(res.body.subarray(1, 4).toString(), 'PNG');
      const zones = JSON.parse(res.headers['X-Kindle-Zones']);
      for (const g of ['close', 'home', 'weather', 'projects', 'news']) {
        assert.ok(zones.some((z) => z.go === g), `${p} has a ${g} zone`);
      }
      for (const z of zones) {
        assert.ok(z.x >= 0 && z.y >= 0 && z.x + z.w <= 1.001 && z.y + z.h <= 1.001, `${p} zone in bounds`);
      }
    }
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('projects page has a tap zone per project and detail has a back zone', async () => {
  const list = await call({ p: 'projects' });
  const rows = JSON.parse(list.headers['X-Kindle-Zones']).filter((z) => z.go === 'project');
  assert.deepEqual(rows.map((z) => z.id).sort(), ['p1', 'p2']);

  const detail = await call({ p: 'project', id: 'p1' });
  assert.equal(detail.code, 200);
  const zones = JSON.parse(detail.headers['X-Kindle-Zones']);
  assert.ok(zones.some((z) => z.go === 'projects' && z.y < 0.15), 'back zone at the top');
});

test('pages still render when weather and news are unreachable', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = fakeFetch({ fail: true });
  try {
    const res = await call({ p: 'home' });
    assert.equal(res.code, 200);
    assert.equal(res.body.subarray(1, 4).toString(), 'PNG');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('zonesHeader is plain ASCII', () => {
  const h = pages.zonesHeader([{ go: 'project', id: 'café' }]);
  assert.match(h, /^[\x20-\x7e]*$/);
  assert.equal(JSON.parse(h)[0].id, 'café');
});
