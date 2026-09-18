import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { StreakStrip } from '@/components/charts';

function lastNDates(n) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (n - 1 - i));
    return d.toISOString().slice(0, 10);
  });
}

export default function RoutineStreaks() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const days = lastNDates(7);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('aio_routines')
        .select('*')
        .gte('completed_at', days[0]);
      const byName = {};
      (data || []).forEach((r) => {
        byName[r.routine_name] = byName[r.routine_name] || new Set();
        byName[r.routine_name].add(r.completed_at);
      });
      setRows(
        Object.entries(byName).map(([name, dates]) => ({
          name,
          days: days.map((d) => dates.has(d)),
        })),
      );
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <p className="text-sm text-muted">Loading…</p>;

  if (rows.length === 0) {
    return <p className="text-sm text-muted">No routines tracked yet.</p>;
  }

  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <div key={r.name} className="flex items-center justify-between gap-3">
          <span className="truncate text-xs text-ink">{r.name}</span>
          <StreakStrip days={r.days} />
        </div>
      ))}
    </div>
  );
}
