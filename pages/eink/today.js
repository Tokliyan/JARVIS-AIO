// Browser preview of exactly what the Kindle PNG shows - same data, same
// black/white/no-shadow styling, so you can check it looks right without
// needing the actual device. Real auth (client-side, same as every other
// page) since this isn't the route the Kindle itself hits - that's the
// unauthenticated .png sibling route.

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const suffix = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')}${suffix}`;
}

export default function EinkTodayPreview() {
  const [loading, setLoading] = useState(true);
  const [periods, setPeriods] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [currentWeek, setCurrentWeek] = useState('A');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const now = new Date();
    const dayNum = now.getDay();
    const todayISO = now.toISOString().slice(0, 10);

    const [{ data: settingsRow }, { data: p }, { data: c }] = await Promise.all([
      supabase.from('aio_settings').select('value').eq('key', 'current_week').maybeSingle(),
      supabase.from('aio_timetable').select('*').eq('day_of_week', dayNum).order('start_time'),
      supabase.from('aio_checklist').select('*').eq('due_date', todayISO),
    ]);

    const week = settingsRow?.value || 'A';
    setCurrentWeek(week);
    setPeriods((p || []).filter((row) => !row.week_type || row.week_type === week));
    setTasks(c || []);
    setLoading(false);
  }

  const now = new Date();
  const nowLabel = now.toLocaleString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  });

  if (loading) {
    return (
      <div style={{ background: '#fff', color: '#000', minHeight: '100vh', padding: 40, fontFamily: 'Georgia, serif' }}>
        Loading…
      </div>
    );
  }

  return (
    <div
      style={{
        background: '#fff',
        color: '#000',
        minHeight: '100vh',
        maxWidth: 700,
        margin: '0 auto',
        padding: '32px 28px',
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: 20,
        lineHeight: 1.4,
      }}
    >
      <div style={{ marginBottom: 16, fontSize: 13, color: '#888', fontFamily: 'sans-serif' }}>
        Preview only — the Kindle fetches /api/eink/today.png directly, not this page.
      </div>

      <h1 style={{ fontSize: 32, margin: '0 0 2px' }}>Today</h1>
      <div style={{ fontSize: 16, color: '#444', marginBottom: 20 }}>{nowLabel} · Week {currentWeek}</div>

      <h2 style={{ fontSize: 20, margin: '24px 0 8px', borderBottom: '2px solid #000', paddingBottom: 4 }}>
        Schedule
      </h2>
      {periods.length === 0 ? (
        <p style={{ color: '#555', fontStyle: 'italic' }}>No school today.</p>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {periods.map((p) => (
            <li
              key={p.id}
              style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #999' }}
            >
              <span>{p.subject}</span>
              <span style={{ color: '#555' }}>{fmtTime(p.start_time)}</span>
            </li>
          ))}
        </ul>
      )}

      <h2 style={{ fontSize: 20, margin: '24px 0 8px', borderBottom: '2px solid #000', paddingBottom: 4 }}>
        Due today
      </h2>
      {tasks.length === 0 ? (
        <p style={{ color: '#555', fontStyle: 'italic' }}>Nothing due today.</p>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {tasks.map((t) => (
            <li key={t.id} style={{ padding: '6px 0', borderBottom: '1px solid #999' }}>
              <span style={{ textDecoration: t.status === 'done' ? 'line-through' : 'none', color: t.status === 'done' ? '#777' : '#000' }}>
                {t.status === 'done' ? '☑' : '☐'} {t.title}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
