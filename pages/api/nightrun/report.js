// The Night Run's inbox. Every overnight job POSTs what it did here, and the
// morning check GETs the whole night back to write the Daily Status summary.
//
// POST /api/nightrun/report
//   Header: Authorization: Bearer <NIGHT_RUN_TOKEN>   (or x-nightrun-key)
//   Body:   { "section": "rade"|"runehaven"|"jarvis"|"leadlens"|"morning",
//             "status": "ok"|"warn"|"fail",
//             "summary": "one or two plain sentences",
//             "needs_you": ["things only Harsh can do"],     // optional
//             "details": { ...anything structured... },        // optional
//             "run_date": "2026-10-13" }                       // optional, defaults to today in Sydney
//
// GET /api/nightrun/report            -> the latest night's reports
// GET /api/nightrun/report?date=YYYY-MM-DD

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { OWNER_ID, checkToken, validateReport, latestPerSection, needsYouFor } from '@/lib/nightRun';

const MISSING_TABLE_HINT =
  'aio_night_runs does not exist yet - run pending-sql/005_aio_night_runs.sql in Supabase';

function friendly(error) {
  const msg = error?.message || String(error);
  if (/aio_night_runs/.test(msg) && /(does not exist|schema cache|PGRST205)/i.test(msg)) return MISSING_TABLE_HINT;
  return msg;
}

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = checkToken(req);
  if (!auth.ok) return res.status(auth.code).json({ error: auth.error });

  let db;
  try {
    db = supabaseAdmin();
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  if (req.method === 'POST') {
    const { row, error } = validateReport(req.body);
    if (error) return res.status(400).json({ error });
    const { data, error: dbError } = await db.from('aio_night_runs').insert(row).select('id').single();
    if (dbError) return res.status(500).json({ error: friendly(dbError) });
    return res.status(200).json({ ok: true, id: data?.id, run_date: row.run_date });
  }

  // GET
  let date = req.query?.date;
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'date must be YYYY-MM-DD' });

  if (!date) {
    const { data: latest, error } = await db
      .from('aio_night_runs')
      .select('run_date')
      .eq('user_id', OWNER_ID)
      .order('run_date', { ascending: false })
      .limit(1);
    if (error) return res.status(500).json({ error: friendly(error) });
    if (!latest?.length) return res.status(200).json({ run_date: null, reports: [], needs_you: [] });
    date = latest[0].run_date;
  }

  const { data: rows, error } = await db
    .from('aio_night_runs')
    .select('*')
    .eq('user_id', OWNER_ID)
    .eq('run_date', date)
    .order('created_at', { ascending: true });
  if (error) return res.status(500).json({ error: friendly(error) });

  const reports = latestPerSection(rows || []);
  return res.status(200).json({ run_date: date, reports, needs_you: needsYouFor(reports) });
}
