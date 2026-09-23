// Returns a bare, self-contained HTML page styled for e-ink — pure black on
// white, large type, no client JS, no app chrome. Meant to be screenshotted
// by a small script on the Kindle side and pushed to the screen, not browsed
// interactively. Gated by a token in the URL since a Kindle can't log in.
//
// GET /api/eink/today?key=...
// GET /api/eink/timetable?key=...
// GET /api/eink/projects?key=...

import { supabaseAdmin } from '@/lib/supabaseAdmin';

const OWNER_ID = '04b4fa14-b541-4b23-92d6-886d6202d727';
const DAY_LABELS = { 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday' };

function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const suffix = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')}${suffix}`;
}

function escapeHtml(s = '') {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const BASE_STYLE = `
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #000; }
  body {
    font-family: Georgia, 'Times New Roman', serif;
    padding: 28px 32px;
    font-size: 22px;
    line-height: 1.35;
  }
  h1 { font-size: 34px; margin: 0 0 2px; }
  .meta { font-size: 18px; color: #444; margin-bottom: 20px; }
  h2 { font-size: 22px; margin: 26px 0 8px; border-bottom: 2px solid #000; padding-bottom: 4px; }
  ul { margin: 0; padding: 0; list-style: none; }
  li { padding: 6px 0; border-bottom: 1px solid #999; display: flex; justify-content: space-between; gap: 16px; }
  li:last-child { border-bottom: none; }
  .dim { color: #555; }
  .strike { text-decoration: line-through; color: #777; }
  .empty { color: #555; font-style: italic; }
  .tag { font-size: 16px; color: #333; }
`;

function page(title, body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>${BASE_STYLE}</style>
</head>
<body>
${body}
</body>
</html>`;
}

export default async function handler(req, res) {
  const view = ['today', 'timetable', 'projects'].includes(req.query.view) ? req.query.view : 'today';

  if (!process.env.EINK_ACCESS_TOKEN || req.query.key !== process.env.EINK_ACCESS_TOKEN) {
    res.status(401).send('Unauthorized');
    return;
  }

  let db;
  try {
    db = supabaseAdmin();
  } catch (err) {
    res.status(500).send(page('Error', `<p>${escapeHtml(err.message)}</p>`));
    return;
  }

  const now = new Date();
  const nowLabel = now.toLocaleString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
  const dayNum = now.getDay();
  const todayISO = now.toISOString().slice(0, 10);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  try {
    if (view === 'today') {
      const [{ data: settingsRow }, { data: periods }, { data: tasks }, { data: readings }] = await Promise.all([
        db.from('aio_settings').select('value').eq('user_id', OWNER_ID).eq('key', 'current_week').maybeSingle(),
        db.from('aio_timetable').select('*').eq('user_id', OWNER_ID).eq('day_of_week', dayNum).order('start_time'),
        db.from('aio_checklist').select('*').eq('user_id', OWNER_ID).eq('due_date', todayISO),
        db.from('aio_room_readings').select('*').eq('user_id', OWNER_ID).order('recorded_at', { ascending: false }).limit(1),
      ]);
      const currentWeek = settingsRow?.value || 'A';
      const visiblePeriods = (periods || []).filter((p) => !p.week_type || p.week_type === currentWeek);
      const reading = readings?.[0];

      const scheduleHtml = visiblePeriods.length
        ? `<ul>${visiblePeriods
            .map((p) => `<li><span>${escapeHtml(p.subject)}</span><span class="dim">${fmtTime(p.start_time)}</span></li>`)
            .join('')}</ul>`
        : `<p class="empty">No school today.</p>`;

      const tasksHtml = tasks?.length
        ? `<ul>${tasks
            .map(
              (t) =>
                `<li><span class="${t.status === 'done' ? 'strike' : ''}">${t.status === 'done' ? '\u2611' : '\u2610'} ${escapeHtml(t.title)}</span><span class="tag">${escapeHtml(t.tag || '')}</span></li>`,
            )
            .join('')}</ul>`
        : `<p class="empty">Nothing due today.</p>`;

      const roomLine = reading
        ? `${reading.temperature_c != null ? `${reading.temperature_c}\u00b0` : '\u2014'} \u00b7 Satellite ${reading.satellite_online ? 'online' : 'offline'}`
        : 'No sensor readings yet';

      res.status(200).send(
        page(
          'Today',
          `<h1>Today</h1><div class="meta">${escapeHtml(nowLabel)} \u00b7 Week ${escapeHtml(currentWeek)}</div>
           <h2>Schedule</h2>${scheduleHtml}
           <h2>Due today</h2>${tasksHtml}
           <h2>Room</h2><p>${escapeHtml(roomLine)}</p>`,
        ),
      );
      return;
    }

    if (view === 'timetable') {
      const [{ data: settingsRow }, { data: periods }] = await Promise.all([
        db.from('aio_settings').select('value').eq('user_id', OWNER_ID).eq('key', 'current_week').maybeSingle(),
        db.from('aio_timetable').select('*').eq('user_id', OWNER_ID).order('day_of_week').order('start_time'),
      ]);
      const currentWeek = settingsRow?.value || 'A';

      const days = [1, 2, 3, 4, 5]
        .map((d) => {
          const dayPeriods = (periods || []).filter((p) => p.day_of_week === d && (!p.week_type || p.week_type === currentWeek));
          const rows = dayPeriods.length
            ? dayPeriods.map((p) => `<li><span>${escapeHtml(p.subject)}</span><span class="dim">${fmtTime(p.start_time)}</span></li>`).join('')
            : `<li class="empty">\u2014</li>`;
          return `<h2>${DAY_LABELS[d]}</h2><ul>${rows}</ul>`;
        })
        .join('');

      res.status(200).send(page('Timetable', `<h1>Timetable</h1><div class="meta">Week ${escapeHtml(currentWeek)}</div>${days}`));
      return;
    }

    if (view === 'projects') {
      const { data: projects } = await db
        .from('aio_projects')
        .select('name, status_label, status_color')
        .eq('user_id', OWNER_ID)
        .order('sort_order');

      const rows = (projects || [])
        .map(
          (p) =>
            `<li><span>${escapeHtml(p.name)}${p.status_color === 'bad' || p.status_color === 'warn' ? ' \u26a0' : ''}</span><span class="dim">${escapeHtml(p.status_label || '')}</span></li>`,
        )
        .join('');

      res.status(200).send(page('Projects', `<h1>Projects</h1><div class="meta">${escapeHtml(nowLabel)}</div><ul>${rows}</ul>`));
      return;
    }
  } catch (err) {
    res.status(500).send(page('Error', `<p>${escapeHtml(err.message)}</p>`));
  }
}
