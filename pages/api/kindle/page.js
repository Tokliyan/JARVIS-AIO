// One page of the Kindle dashboard as a PNG, plus its tap zones in a header.
//
//   GET /api/kindle/page?p=home|weather|projects|news|project[&id=<project id>][&w=1072&h=1448]
//   Authorization: Bearer <KINDLE_COMMAND_TOKEN>
//   -> image/png, with   X-Kindle-Zones: [{x,y,w,h,go,id?}, ...]   (fractions 0-1)
//
// Same shared secret as /api/kindle/command, so the Ask JARVIS plugin only
// needs one token. Unlike the older public /api/eink/today.png, nothing here
// is readable without it.

import { createCanvas } from '@napi-rs/canvas';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { extractToken, tokenOk } from '@/lib/kindleCommand';
import { PAGES, buildScene, renderScene, errorScene, zonesHeader } from '@/lib/kindlePages';

function clampInt(v, lo, hi, fallback) {
  const n = parseInt(v, 10);
  return Math.min(Math.max(Number.isFinite(n) ? n : fallback, lo), hi);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'GET only' });

  const expected = process.env.KINDLE_COMMAND_TOKEN;
  if (!expected) return res.status(500).json({ ok: false, error: 'KINDLE_COMMAND_TOKEN is not set on the server' });
  if (!tokenOk(extractToken(req), expected)) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  const page = req.query.p === 'project' || PAGES.includes(req.query.p) ? req.query.p : 'home';
  const id = typeof req.query.id === 'string' ? req.query.id.slice(0, 64) : undefined;
  const width = clampInt(req.query.w, 400, 2000, 1072);
  const height = clampInt(req.query.h, 600, 2600, 1448);

  let scene;
  try {
    scene = await buildScene({ page, id }, { db: supabaseAdmin() });
  } catch (err) {
    scene = errorScene(err?.message || err);
  }

  const { png, zones } = renderScene(createCanvas, scene, width, height);
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Kindle-Zones', zonesHeader(zones));
  res.status(200).send(png);
}
