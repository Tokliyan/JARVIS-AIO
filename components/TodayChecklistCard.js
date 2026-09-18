import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function TodayChecklistCard() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('aio_checklist')
      .select('*')
      .eq('due_date', todayISO())
      .order('priority', { ascending: false });
    setItems(data || []);
    setLoading(false);
  }

  async function toggleDone(item) {
    const next = item.status === 'done' ? 'not_started' : 'done';
    await supabase
      .from('aio_checklist')
      .update({
        status: next,
        completed_at: next === 'done' ? new Date().toISOString() : null,
      })
      .eq('id', item.id);
    load();
  }

  const done = items.filter((i) => i.status === 'done').length;
  const total = items.length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <div className="rounded border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs text-muted">Due today</span>
        <span className="font-mono text-xs text-muted">
          {done}/{total}
        </span>
      </div>

      <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-bg">
        <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted">Nothing due today.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={item.status === 'done'}
                onChange={() => toggleDone(item)}
                className="h-3.5 w-3.5"
              />
              <span className={item.status === 'done' ? 'text-muted line-through' : 'text-ink'}>
                {item.title}
              </span>
              <span className="ml-auto text-xs text-muted">{item.tag}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
