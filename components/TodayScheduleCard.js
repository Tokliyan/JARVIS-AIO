import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function TodayScheduleCard() {
  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(true);
  const todayNum = new Date().getDay(); // 0 Sun .. 6 Sat

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    if (todayNum >= 1 && todayNum <= 5) {
      const { data } = await supabase
        .from('aio_timetable')
        .select('*')
        .eq('day_of_week', todayNum)
        .order('period_number');
      setPeriods(data || []);
    }
    setLoading(false);
  }

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  return (
    <div className="rounded border border-border bg-surface p-4">
      <div className="mb-3 text-xs text-muted">Today&rsquo;s schedule</div>

      {todayNum === 0 || todayNum === 6 ? (
        <p className="text-sm text-muted">No school today.</p>
      ) : loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : periods.length === 0 ? (
        <p className="text-sm text-muted">Nothing on the timetable for today yet.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {periods.map((p) => {
            const [h, m] = (p.end_time || '00:00').split(':').map(Number);
            const isPast = h * 60 + m < nowMinutes;
            return (
              <li
                key={p.id}
                className={`flex items-center gap-3 text-sm ${
                  isPast ? 'text-muted line-through' : 'text-ink'
                }`}
              >
                <span className="w-12 shrink-0 font-mono text-xs text-muted">
                  {p.start_time?.slice(0, 5)}
                </span>
                <span className="flex-1">{p.subject}</span>
                {p.room && <span className="text-xs text-muted">{p.room}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
