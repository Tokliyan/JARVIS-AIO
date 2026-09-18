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

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function RoutineStreaks({ manage = false }) {
  const [defs, setDefs] = useState([]);
  const [done, setDone] = useState({});
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newWhen, setNewWhen] = useState('morning');
  const [newEvery, setNewEvery] = useState(1);
  const days = lastNDates(7);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    const [d, c] = await Promise.all([
      supabase.from('aio_routine_defs').select('*').eq('active', true).order('sort_order'),
      supabase.from('aio_routines').select('*').gte('completed_at', days[0]),
    ]);
    setDefs(d.data || []);
    const map = {};
    (c.data || []).forEach((r) => {
      map[r.routine_name] = map[r.routine_name] || new Set();
      map[r.routine_name].add(r.completed_at);
    });
    setDone(map);
    setLoading(false);
  }

  async function toggleToday(def) {
    const t = todayISO();
    const already = done[def.name]?.has(t);

    // optimistic
    setDone((prev) => {
      const next = { ...prev };
      const set = new Set(next[def.name] || []);
      already ? set.delete(t) : set.add(t);
      next[def.name] = set;
      return next;
    });

    if (already) {
      await supabase
        .from('aio_routines')
        .delete()
        .eq('routine_name', def.name)
        .eq('completed_at', t);
    } else {
      await supabase.from('aio_routines').insert({
        routine_name: def.name,
        recurrence_days: def.recurrence_days,
        completed_at: t,
      });
    }
  }

  async function addRoutine(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    await supabase.from('aio_routine_defs').insert({
      name: newName.trim(),
      time_of_day: newWhen,
      recurrence_days: Number(newEvery) || 1,
      sort_order: defs.length + 1,
    });
    setNewName('');
    load();
  }

  async function removeRoutine(id) {
    await supabase.from('aio_routine_defs').update({ active: false }).eq('id', id);
    load();
  }

  if (loading) return <p className="text-sm text-muted">Loading…</p>;

  if (defs.length === 0) {
    return manage ? (
      <div>
        <p className="mb-3 text-sm text-muted">
          No routines yet. Add one and it&rsquo;ll show up on Today to tick off.
        </p>
        <AddForm />
      </div>
    ) : (
      <p className="text-sm text-muted">No routines set up yet.</p>
    );
  }

  function AddForm() {
    return (
      <form onSubmit={addRoutine} className="flex flex-wrap items-center gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Routine name"
          className="min-w-[9rem] flex-1 rounded border border-border bg-surface px-2 py-1.5 text-sm"
        />
        <select
          value={newWhen}
          onChange={(e) => setNewWhen(e.target.value)}
          className="rounded border border-border bg-surface px-2 py-1.5 text-sm"
        >
          <option value="morning">Morning</option>
          <option value="evening">Evening</option>
          <option value="anytime">Anytime</option>
        </select>
        <label className="flex items-center gap-1.5 text-xs text-muted">
          every
          <input
            type="number"
            min="1"
            value={newEvery}
            onChange={(e) => setNewEvery(e.target.value)}
            className="tnum w-14 rounded border border-border bg-surface px-2 py-1.5 text-sm"
          />
          day(s)
        </label>
        <button
          type="submit"
          className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-white"
        >
          Add
        </button>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {defs.map((def) => {
        const set = done[def.name] || new Set();
        const isDone = set.has(todayISO());
        const streak = days.map((d) => set.has(d));
        const hit = streak.filter(Boolean).length;

        return (
          <div key={def.id} className="group flex items-center gap-2.5">
            <button
              onClick={() => toggleToday(def)}
              aria-label={`${isDone ? 'Undo' : 'Complete'} ${def.name}`}
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-all ${
                isDone
                  ? 'scale-100 border-accent bg-accent text-white'
                  : 'border-rule text-transparent hover:border-accent'
              }`}
            >
              <span className="text-[9px] leading-none">✓</span>
            </button>

            <div className="min-w-0 flex-1">
              <div
                className={`truncate text-xs transition-colors ${
                  isDone ? 'text-faint' : 'text-ink'
                }`}
              >
                {def.name}
              </div>
              {manage && (
                <div className="text-2xs text-faint">
                  {def.time_of_day}
                  {def.recurrence_days > 1 ? ` · every ${def.recurrence_days} days` : ''}
                  {` · ${hit}/7`}
                </div>
              )}
            </div>

            <StreakStrip days={streak} />

            {manage && (
              <button
                onClick={() => removeRoutine(def.id)}
                className="shrink-0 text-xs text-faint opacity-0 transition-opacity hover:text-bad group-hover:opacity-100"
              >
                Remove
              </button>
            )}
          </div>
        );
      })}

      {manage && (
        <div className="mt-2 border-t border-border pt-3">
          <AddForm />
        </div>
      )}
    </div>
  );
}
