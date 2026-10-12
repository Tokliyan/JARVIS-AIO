import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { state, resetState } from './fakeSupabaseAdmin.mjs';

process.env.NIGHT_RUN_TOKEN = 'night-secret';

const { default: report } = await import('../pages/api/nightrun/report.js');
const { default: queue } = await import('../pages/api/nightrun/queue.js');
const { default: manychat } = await import('../pages/api/nightrun/manychat.js');
const nr = await import('../lib/nightRun.js');

const OWNER = nr.OWNER_ID;

function call(handler, { method = 'GET', token = 'night-secret', body, query = {} } = {}) {
  const req = { method, headers: token ? { authorization: `Bearer ${token}` } : {}, body, query };
  const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
  return handler(req, res).then(() => res);
}

beforeEach(() => {
  resetState({
    aio_night_runs: [],
    aio_projects: [
      { id: 'p1', user_id: OWNER, name: 'Ambient Intelligence', sort_order: 1, roadmap: [
        { title: 'Dark mode toggle', status: 'planned' },
        { title: 'Old thing', status: 'done' },
        { title: 'Weekly view', status: 'in_progress' },
      ] },
      { id: 'p2', user_id: OWNER, name: 'Rade.XT', sort_order: 2, roadmap: [{ title: 'Candles', status: 'planned' }] },
      { id: 'px', user_id: 'someone-else', name: 'Not mine', sort_order: 3, roadmap: [{ title: 'Nope', status: 'planned' }] },
    ],
  });
});

test('every endpoint rejects a missing or wrong token', async () => {
  for (const h of [report, queue, manychat]) {
    assert.equal((await call(h, { token: null })).code, 401);
    assert.equal((await call(h, { token: 'wrong' })).code, 401);
  }
});

test('report: validates input', async () => {
  assert.equal((await call(report, { method: 'POST', body: { section: 'nope', status: 'ok', summary: 'x' } })).code, 400);
  assert.equal((await call(report, { method: 'POST', body: { section: 'rade', status: 'great', summary: 'x' } })).code, 400);
  assert.equal((await call(report, { method: 'POST', body: { section: 'rade', status: 'ok', summary: '  ' } })).code, 400);
  assert.equal((await call(report, { method: 'POST', body: { section: 'rade', status: 'ok', summary: 'x', needs_you: 'run sql' } })).code, 400);
  assert.equal((await call(report, { method: 'DELETE' })).code, 405);
});

test('report: stores a row for the owner and trims needs_you', async () => {
  const res = await call(report, {
    method: 'POST',
    body: { section: 'rade', status: 'warn', summary: 'Tests passed, 1 agent refined', needs_you: ['Run 005', '', 'Deploy Render'], details: { trades: 4 }, run_date: '2026-10-13' },
  });
  assert.equal(res.code, 200);
  const row = state.tables.aio_night_runs[0];
  assert.equal(row.user_id, OWNER);
  assert.equal(row.run_date, '2026-10-13');
  assert.deepEqual(row.needs_you, ['Run 005', 'Deploy Render']);
});

test('report GET returns the latest night, newest row per section, morning list wins', async () => {
  state.tables.aio_night_runs.push(
    { user_id: OWNER, run_date: '2026-10-12', section: 'rade', status: 'ok', summary: 'old', needs_you: ['old thing'], created_at: '2026-10-11T17:40:00Z' },
    { user_id: OWNER, run_date: '2026-10-13', section: 'rade', status: 'fail', summary: 'first try', needs_you: ['a'], created_at: '2026-10-12T17:40:00Z' },
    { user_id: OWNER, run_date: '2026-10-13', section: 'rade', status: 'ok', summary: 'retry', needs_you: ['b'], created_at: '2026-10-12T17:50:00Z' },
    { user_id: OWNER, run_date: '2026-10-13', section: 'runehaven', status: 'warn', summary: 'built', needs_you: ['c'], created_at: '2026-10-12T18:20:00Z' },
  );
  let res = await call(report);
  assert.equal(res.body.run_date, '2026-10-13');
  assert.deepEqual(res.body.reports.map((r) => r.summary), ['retry', 'built']);
  assert.deepEqual(res.body.needs_you, ['b', 'c']);

  state.tables.aio_night_runs.push({ user_id: OWNER, run_date: '2026-10-13', section: 'morning', status: 'warn', summary: 'sum', needs_you: ['only this'], created_at: '2026-10-12T19:05:00Z' });
  res = await call(report);
  assert.deepEqual(res.body.needs_you, ['only this']);

  res = await call(report, { query: { date: '2026-10-12' } });
  assert.deepEqual(res.body.reports.map((r) => r.summary), ['old']);
});

test('report: explains a missing table instead of a raw error', async () => {
  state.missingTables = ['aio_night_runs'];
  const res = await call(report, { method: 'POST', body: { section: 'jarvis', status: 'ok', summary: 'x' } });
  assert.equal(res.code, 500);
  assert.match(res.body.error, /pending-sql\/005/);
});

test('queue: lists only open items from the owner\'s projects', async () => {
  const res = await call(queue);
  assert.equal(res.code, 200);
  assert.deepEqual(res.body.items.map((i) => i.title), ['Dark mode toggle', 'Weekly view', 'Candles']);
  const scoped = await call(queue, { query: { project: 'ambient' } });
  assert.deepEqual(scoped.body.items.map((i) => i.title), ['Dark mode toggle', 'Weekly view']);
});

test('queue: marks an item by exact title and leaves the rest alone', async () => {
  const res = await call(queue, { method: 'POST', body: { project_id: 'p1', title: 'Dark mode toggle', status: 'done' } });
  assert.equal(res.code, 200);
  const roadmap = state.tables.aio_projects[0].roadmap;
  assert.equal(roadmap[0].status, 'done');
  assert.equal(roadmap[2].status, 'in_progress');
  assert.equal((await call(queue, { method: 'POST', body: { project_id: 'p1', title: 'dark mode', status: 'done' } })).code, 404);
  assert.equal((await call(queue, { method: 'POST', body: { project_id: 'px', title: 'Nope', status: 'done' } })).code, 404);
  assert.equal((await call(queue, { method: 'POST', body: { project_id: 'p1', title: 'Weekly view', status: 'shipped' } })).code, 400);
});

test('manychat: reports unconfigured instead of failing, and never leaks the key', async () => {
  delete process.env.MANYCHAT_API_KEY;
  let res = await call(manychat);
  assert.equal(res.body.configured, false);

  process.env.MANYCHAT_API_KEY = 'mc-key';
  const seen = [];
  globalThis.fetch = async (url, init) => {
    seen.push([url, init.headers.Authorization]);
    const data = url.endsWith('getInfo') ? { id: 1, name: 'leadlensai' }
      : url.endsWith('getFlows') ? { flows: [{ name: 'Lane 2 - AGENT', ns: 'x' }] }
      : url.endsWith('getTags') ? [{ name: 'Tradie' }]
      : null;
    if (!data) return { ok: false, status: 404, json: async () => ({ status: 'error', message: 'nope' }) };
    return { ok: true, status: 200, json: async () => ({ status: 'success', data }) };
  };
  res = await call(manychat);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.page.name, 'leadlensai');
  assert.deepEqual(res.body.flows.map((f) => f.name), ['Lane 2 - AGENT']);
  assert.ok(res.body.errors.growth_tools);
  assert.ok(seen.every(([, h]) => h === 'Bearer mc-key'));
  assert.ok(!JSON.stringify(res.body).includes('mc-key'));
});

test('sydneyDate rolls over at Sydney midnight, not UTC', () => {
  assert.equal(nr.sydneyDate(new Date('2026-10-12T14:30:00Z')), '2026-10-13');
  assert.equal(nr.sydneyDate(new Date('2026-10-12T12:00:00Z')), '2026-10-12');
});
