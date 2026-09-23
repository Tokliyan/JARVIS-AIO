// The Kindle fetches this directly - no login possible on a jailbroken
// e-reader, so intentionally no auth here. Read-only schedule/task data,
// low sensitivity. Renders a real PNG with @napi-rs/canvas (prebuilt native
// binary, verified working in this environment before this file was written).
//
// GET /api/eink/today.png.js
// GET /api/eink/today.png.js?w=1072&h=1448

import { createCanvas } from '@napi-rs/canvas';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const OWNER_ID = '04b4fa14-b541-4b23-92d6-886d6202d727';

function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const suffix = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')}${suffix}`;
}

export default async function handler(req, res) {
  const width = Math.min(Math.max(parseInt(req.query.w, 10) || 1072, 200), 2000);
  const height = Math.min(Math.max(parseInt(req.query.h, 10) || 1448, 200), 2600);

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // white background, black everything - e-ink has no useful greys
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#000000';

  const pad = Math.round(width * 0.06);
  let y = pad;
  const lineGap = Math.round(width * 0.018);
  const bigFont = Math.round(width * 0.052);
  const metaFont = Math.round(width * 0.03);
  const headFont = Math.round(width * 0.038);
  const bodyFont = Math.round(width * 0.032);

  function hr() {
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(width - pad, y);
    ctx.stroke();
    y += lineGap * 1.5;
  }

  try {
    const db = supabaseAdmin();
    const now = new Date();
    const dayNum = now.getDay();
    const todayISO = now.toISOString().slice(0, 10);

    const [{ data: settingsRow }, { data: periods }, { data: tasks }] = await Promise.all([
      db.from('aio_settings').select('value').eq('user_id', OWNER_ID).eq('key', 'current_week').maybeSingle(),
      db.from('aio_timetable').select('*').eq('user_id', OWNER_ID).eq('day_of_week', dayNum).order('start_time'),
      db.from('aio_checklist').select('*').eq('user_id', OWNER_ID).eq('due_date', todayISO),
    ]);
    const currentWeek = settingsRow?.value || 'A';
    const visiblePeriods = (periods || []).filter((p) => !p.week_type || p.week_type === currentWeek);

    // Header
    ctx.font = `bold ${bigFont}px sans-serif`;
    ctx.fillText('Today', pad, y + bigFont);
    y += bigFont + lineGap;

    ctx.font = `${metaFont}px sans-serif`;
    const nowLabel = now.toLocaleString('en-AU', {
      weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
    });
    ctx.fillText(`${nowLabel} · Week ${currentWeek}`, pad, y + metaFont);
    y += metaFont + lineGap * 2;

    hr();

    // Schedule
    ctx.font = `bold ${headFont}px sans-serif`;
    ctx.fillText('Schedule', pad, y + headFont);
    y += headFont + lineGap;
    ctx.font = `${bodyFont}px sans-serif`;

    if (visiblePeriods.length === 0) {
      ctx.fillText('No school today.', pad, y + bodyFont);
      y += bodyFont + lineGap;
    } else {
      for (const p of visiblePeriods) {
        const time = fmtTime(p.start_time);
        ctx.fillText(p.subject, pad, y + bodyFont);
        const timeWidth = ctx.measureText(time).width;
        ctx.fillText(time, width - pad - timeWidth, y + bodyFont);
        y += bodyFont + lineGap * 1.3;
        if (y > height - 200) break; // leave room for tasks section
      }
    }

    y += lineGap;
    hr();

    // Due today
    ctx.font = `bold ${headFont}px sans-serif`;
    ctx.fillText('Due today', pad, y + headFont);
    y += headFont + lineGap;
    ctx.font = `${bodyFont}px sans-serif`;

    if (!tasks || tasks.length === 0) {
      ctx.fillText('Nothing due today.', pad, y + bodyFont);
      y += bodyFont + lineGap;
    } else {
      for (const t of tasks) {
        const box = t.status === 'done' ? '\u2611' : '\u2610';
        const label = `${box} ${t.title}`;
        ctx.fillText(label, pad, y + bodyFont);
        if (t.status === 'done') {
          const w = ctx.measureText(label).width;
          ctx.beginPath();
          ctx.moveTo(pad, y + bodyFont * 0.55);
          ctx.lineTo(pad + w, y + bodyFont * 0.55);
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        y += bodyFont + lineGap * 1.3;
        if (y > height - 60) break;
      }
    }

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(canvas.toBuffer('image/png'));
  } catch (err) {
    // Render the error onto the image itself rather than failing silently -
    // a blank/broken image on a Kindle with no console is undiagnosable.
    ctx.font = `${bodyFont}px sans-serif`;
    ctx.fillText('Error loading data:', pad, y + bodyFont);
    y += bodyFont + lineGap;
    ctx.font = `${Math.round(bodyFont * 0.75)}px sans-serif`;
    ctx.fillText(String(err.message || err).slice(0, 120), pad, y + bodyFont);
    res.setHeader('Content-Type', 'image/png');
    res.status(200).send(canvas.toBuffer('image/png'));
  }
}
