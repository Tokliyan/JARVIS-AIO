// LeadLens Lane 2 health check for the morning run. The ManyChat key lives
// only here on the server (Render env MANYCHAT_API_KEY) — the routine just
// holds NIGHT_RUN_TOKEN and asks this endpoint.
//
// GET /api/nightrun/manychat
//   -> { ok, page: {...}, flows: [...], tags: [...], errors: {...} }
//
// What this can and can't tell you: ManyChat's public API exposes the page,
// its flows, tags and growth tools — enough to confirm Lane 2 is still
// connected and its flow still exists. It does NOT expose comment/DM counts,
// so the morning check never invents engagement numbers from it.

import { checkToken } from '@/lib/nightRun';

const BASE = 'https://api.manychat.com/fb/page';

async function get(path, key) {
  const r = await fetch(`${BASE}/${path}`, {
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
  });
  let body = null;
  try {
    body = await r.json();
  } catch {
    body = null;
  }
  if (!r.ok || body?.status === 'error') {
    throw new Error(body?.message || `HTTP ${r.status}`);
  }
  return body?.data;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const auth = checkToken(req);
  if (!auth.ok) return res.status(auth.code).json({ error: auth.error });

  const key = process.env.MANYCHAT_API_KEY;
  if (!key) {
    return res.status(200).json({ ok: false, configured: false, error: 'MANYCHAT_API_KEY is not set in Render' });
  }

  const errors = {};
  const settle = async (name, path) => {
    try {
      return await get(path, key);
    } catch (err) {
      errors[name] = err.message;
      return null;
    }
  };

  const [page, flows, tags, growthTools] = await Promise.all([
    settle('page', 'getInfo'),
    settle('flows', 'getFlows'),
    settle('tags', 'getTags'),
    settle('growth_tools', 'getGrowthTools'),
  ]);

  const flowList = Array.isArray(flows?.flows) ? flows.flows : Array.isArray(flows) ? flows : [];

  return res.status(200).json({
    ok: !errors.page,
    configured: true,
    page: page ? { name: page.name, id: page.id, is_pro: page.is_pro ?? null } : null,
    flows: flowList.map((f) => ({ name: f.name, ns: f.ns })).slice(0, 50),
    tags: (Array.isArray(tags) ? tags : []).map((t) => t.name).slice(0, 50),
    growth_tools: (Array.isArray(growthTools) ? growthTools : []).map((g) => ({ name: g.name, type: g.type })).slice(0, 50),
    errors,
  });
}
