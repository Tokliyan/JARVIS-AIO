// Lets the nightly build routines see (and tick off) the real roadmap.
//
// Why this exists: the routines only ever had the Supabase ANON key, and RLS
// hides every aio_ row from an anonymous key, so the roadmap always came back
// [] — indistinguishable from "nothing planned". This reads it server-side
// with the service key instead, behind NIGHT_RUN_TOKEN, so the routine never
// has to hold a key that bypasses RLS.
//
// GET  /api/nightrun/queue
//   -> { items: [{ project_id, project, index, title, status }] }   (everything not "done")
//   ?project=ambient   narrows to projects whose name contains that text
//
// POST /api/nightrun/queue
//   Body: { "project_id": "...", "title": "exact roadmap item title", "status": "in_progress"|"done" }

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { OWNER_ID, checkToken, openRoadmapItems } from '@/lib/nightRun';

const ALLOWED_STATUS = ['planned', 'in_progress', 'done'];

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
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

  if (req.method === 'GET') {
    const { data: projects, error } = await db
      .from('aio_projects')
      .select('id, name, roadmap')
      .eq('user_id', OWNER_ID)
      .order('sort_order');
    if (error) return res.status(500).json({ error: error.message });

    const filter = String(req.query?.project || '').toLowerCase().trim();
    const scoped = filter ? (projects || []).filter((p) => String(p.name).toLowerCase().includes(filter)) : projects || [];
    return res.status(200).json({ projects_seen: (projects || []).length, items: openRoadmapItems(scoped) });
  }

  const { project_id, title, status } = req.body || {};
  if (!project_id || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'project_id and title are required' });
  }
  if (!ALLOWED_STATUS.includes(status)) {
    return res.status(400).json({ error: `status must be one of ${ALLOWED_STATUS.join(', ')}` });
  }

  const { data: project, error } = await db
    .from('aio_projects')
    .select('id, roadmap')
    .eq('user_id', OWNER_ID)
    .eq('id', project_id)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const roadmap = Array.isArray(project.roadmap) ? project.roadmap : [];
  const idx = roadmap.findIndex((item) => item?.title === title);
  if (idx === -1) return res.status(404).json({ error: 'No roadmap item with that exact title' });

  const next = roadmap.map((item, i) => (i === idx ? { ...item, status } : item));
  const { error: updateError } = await db
    .from('aio_projects')
    .update({ roadmap: next, updated_at: new Date().toISOString() })
    .eq('id', project_id)
    .eq('user_id', OWNER_ID);
  if (updateError) return res.status(500).json({ error: updateError.message });

  return res.status(200).json({ ok: true, title, status });
}
