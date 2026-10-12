// Shared helpers for the Night Run — the overnight jobs (Rade.XT on GitHub
// Actions, the RuneHaven and JARVIS build routines, the morning check) that
// report into AIO. None of them can log in, so like the Satellite and Kindle
// endpoints they're gated by one shared secret instead: NIGHT_RUN_TOKEN.

export const OWNER_ID = '04b4fa14-b541-4b23-92d6-886d6202d727';

export const SECTIONS = ['rade', 'runehaven', 'jarvis', 'leadlens', 'morning'];
export const STATUSES = ['ok', 'warn', 'fail'];

const MAX_SUMMARY = 600;
const MAX_NEEDS = 10;
const MAX_NEED_LEN = 240;
const MAX_DETAILS_BYTES = 20000;

export function checkToken(req) {
  const expected = process.env.NIGHT_RUN_TOKEN;
  if (!expected) return { ok: false, code: 500, error: 'NIGHT_RUN_TOKEN is not set on the server' };
  const auth = req.headers?.authorization || '';
  const given = auth.startsWith('Bearer ') ? auth.slice(7) : req.headers?.['x-nightrun-key'];
  if (!given || given !== expected) return { ok: false, code: 401, error: 'Unauthorized' };
  return { ok: true };
}

// The night run belongs to the Sydney calendar day it finishes on — a 4am
// run on Tuesday is "Tuesday's" report, even though it's Monday in UTC.
export function sydneyDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney' }).format(now);
}

export function validateReport(body) {
  if (!body || typeof body !== 'object') return { error: 'Body must be a JSON object' };
  const { section, status, summary, details, needs_you, run_date } = body;

  if (!SECTIONS.includes(section)) return { error: `section must be one of ${SECTIONS.join(', ')}` };
  if (!STATUSES.includes(status)) return { error: `status must be one of ${STATUSES.join(', ')}` };
  if (typeof summary !== 'string' || !summary.trim()) return { error: 'summary is required' };

  let needs = [];
  if (needs_you != null) {
    if (!Array.isArray(needs_you)) return { error: 'needs_you must be an array of strings' };
    needs = needs_you
      .filter((n) => typeof n === 'string' && n.trim())
      .slice(0, MAX_NEEDS)
      .map((n) => n.trim().slice(0, MAX_NEED_LEN));
  }

  let safeDetails = {};
  if (details != null) {
    if (typeof details !== 'object' || Array.isArray(details)) return { error: 'details must be an object' };
    if (JSON.stringify(details).length > MAX_DETAILS_BYTES) return { error: 'details is too large' };
    safeDetails = details;
  }

  if (run_date != null && !/^\d{4}-\d{2}-\d{2}$/.test(run_date)) return { error: 'run_date must be YYYY-MM-DD' };

  return {
    row: {
      user_id: OWNER_ID,
      run_date: run_date || sydneyDate(),
      section,
      status,
      summary: summary.trim().slice(0, MAX_SUMMARY),
      details: safeDetails,
      needs_you: needs,
    },
  };
}

// Newest report per section for one run date, in a fixed display order.
export function latestPerSection(rows = []) {
  const bySection = {};
  for (const r of rows) {
    const prev = bySection[r.section];
    if (!prev || String(r.created_at) > String(prev.created_at)) bySection[r.section] = r;
  }
  return SECTIONS.filter((s) => bySection[s]).map((s) => bySection[s]);
}

// The "needs you" list the Daily Status card and the Kindle show: the morning
// check's list when it has run (it already de-duplicates everything), else
// everything the individual jobs flagged.
export function needsYouFor(reports = []) {
  const morning = reports.find((r) => r.section === 'morning');
  if (morning) return morning.needs_you || [];
  const all = reports.flatMap((r) => r.needs_you || []);
  return [...new Set(all)];
}

export const SECTION_LABELS = {
  rade: 'Rade.XT',
  runehaven: 'RuneHaven',
  jarvis: 'JARVIS build',
  leadlens: 'LeadLens',
  morning: 'Morning check',
};

// Roadmap items a build routine should look at: anything not done yet.
export function openRoadmapItems(projects = []) {
  const out = [];
  for (const p of projects) {
    const items = Array.isArray(p.roadmap) ? p.roadmap : [];
    items.forEach((item, index) => {
      if (item && item.status !== 'done') {
        out.push({ project_id: p.id, project: p.name, index, title: item.title, status: item.status || 'planned' });
      }
    });
  }
  return out;
}
