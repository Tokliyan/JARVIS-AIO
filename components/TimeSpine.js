import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Tile from '@/components/Tile';

function minutesNow(d = new Date()) {
  return d.getHours() * 60 + d.getMinutes();
}

function toMinutes(hhmm) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function fmt(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const suffix = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')}${suffix}`;
}

export default function TimeSpine() {
  const [periods, setPeriods] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(minutesNow());

  const dayNum = new Date().getDay();
  const isSchoolDay = dayNum >= 1 && dayNum <= 5;
  const todayISO = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    load();
    const t = setInterval(() => setNow(minutesNow()), 60000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    const [p, c] = await Promise.all([
      isSchoolDay
        ? supabase.from('aio_timetable').select('*').eq('day_of_week', dayNum).order('period_number')
        : Promise.resolve({ data: [] }),
      supabase.from('aio_checklist').select('*').eq('due_date', todayISO),
    ]);
    setPeriods(p.data || []);
    setTasks(c.data || []);
    setLoading(false);
  }

  async function toggle(task) {
    const next = task.status === 'done' ? 'not_started' : 'done';
    setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, status: next } : t)));
    await supabase
      .from('aio_checklist')
      .update({ status: next, completed_at: next === 'done' ? new Date().toISOString() : null })
      .eq('id', task.id);
  }

  // Schedule and tasks become one time-ordered stream — because that's how the
  // day actually runs. Tasks with no specific time sort to the end.
  const items = [
    ...periods.map((p) => ({
      kind: 'period',
      id: p.id,
      at: toMinutes(p.start_time),
      end: toMinutes(p.end_time),
      title: p.subject,
      meta: p.room,
      tag: `School · ${p.subject}`,
    })),
    ...tasks.map((t) => ({
      kind: 'task',
      id: t.id,
      at: null,
      title: t.title,
      tag: t.tag,
      status: t.status,
      raw: t,
    })),
  ].sort((a, b) => (a.at ?? 2000) - (b.at ?? 2000));

  const doneCount = tasks.filter((t) => t.status === 'done').length;

  if (loading) {
    return <p className="text-sm text-muted">Loading today…</p>;
  }

  if (items.length === 0) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm text-ink">Nothing scheduled today.</p>
        <p className="mt-1 text-xs text-muted">
          Add a task with the bar below, or set up your timetable.
        </p>
      </div>
    );
  }

  let nowPlaced = false;

  return (
    <div className="relative pl-6">
      {/* the spine */}
      <div
        className="absolute left-[7px] top-1 bottom-1 w-px origin-top animate-spine-draw bg-rule"
        aria-hidden="true"
      />

      <ul className="flex flex-col">
        {items.map((item, i) => {
          const isPast = item.at !== null && item.end !== null && item.end < now;
          const isLive = item.at !== null && item.at <= now && (item.end ?? 0) >= now;
          const showNowBefore = !nowPlaced && item.at !== null && item.at > now;
          if (showNowBefore) nowPlaced = true;

          return (
            <li key={`${item.kind}-${item.id}`}>
              {showNowBefore && <NowMarker now={now} />}

              <div
                className="relative flex items-center gap-3 py-2 animate-row-in"
                style={{ animationDelay: `${Math.min(i * 40, 400)}ms` }}
              >
                <span
                  className={`absolute -left-6 h-1.5 w-1.5 rounded-full ${
                    isLive ? 'bg-accent' : isPast ? 'bg-border' : 'bg-rule'
                  }`}
                  style={{ left: '-1.4rem' }}
                  aria-hidden="true"
                />

                {item.kind === 'task' ? (
                  <>
                    <input
                      type="checkbox"
                      checked={item.status === 'done'}
                      onChange={() => toggle(item.raw)}
                      className="h-3.5 w-3.5 accent-accent"
                      aria-label={item.title}
                    />
                    <Tile tag={item.tag} size="sm" />
                    <span
                      className={`flex-1 text-sm transition-colors ${
                        item.status === 'done' ? 'text-faint line-through' : 'text-ink'
                      }`}
                    >
                      {item.title}
                    </span>
                    <span className="text-xs text-faint">{item.tag}</span>
                  </>
                ) : (
                  <>
                    <span className="tnum w-16 shrink-0 text-xs text-muted">{fmt(item.at)}</span>
                    <span
                      className={`flex-1 text-sm ${
                        isLive ? 'font-medium text-ink' : isPast ? 'text-faint' : 'text-ink'
                      }`}
                    >
                      {item.title}
                    </span>
                    {isLive && <span className="text-xs text-accent">now</span>}
                    {item.meta && !isLive && (
                      <span className="text-xs text-faint">{item.meta}</span>
                    )}
                  </>
                )}
              </div>
            </li>
          );
        })}
        {!nowPlaced && <NowMarker now={now} trailing />}
      </ul>

      {tasks.length > 0 && (
        <p className="mt-4 border-t border-border pt-3 text-xs text-muted">
          <span className="tnum">{doneCount}</span> of{' '}
          <span className="tnum">{tasks.length}</span> done today
        </p>
      )}
    </div>
  );
}

function NowMarker({ now, trailing }) {
  return (
    <div
      className={`relative flex animate-now-settle items-center gap-2 ${trailing ? 'pt-2' : 'py-1'}`}
    >
      <span
        className="absolute h-2 w-2 animate-pulse-soft rounded-full bg-accent"
        style={{ left: '-1.55rem' }}
        aria-hidden="true"
      />
      <span className="tnum w-16 shrink-0 text-xs font-medium text-accent">{fmt(now)}</span>
      <span className="h-px flex-1 bg-accent/25" aria-hidden="true" />
    </div>
  );
}
