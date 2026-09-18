'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

const PRIORITY_DOT = { low: 'bg-muted', med: 'bg-warn', high: 'bg-bad' };

export default function Checklist() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [tag, setTag] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState('med');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('aio_checklist')
      .select('*')
      .order('due_date', { ascending: true, nullsFirst: false });
    if (!error) setItems(data);
    setLoading(false);
  }

  async function addItem(e) {
    e.preventDefault();
    if (!title.trim()) return;
    const { error } = await supabase.from('aio_checklist').insert({
      title: title.trim(),
      tag: tag.trim() || 'General',
      due_date: dueDate || null,
      priority,
    });
    if (!error) {
      setTitle('');
      setTag('');
      setDueDate('');
      setPriority('med');
      load();
    }
  }

  async function toggleDone(item) {
    const nextStatus = item.status === 'done' ? 'not_started' : 'done';
    await supabase
      .from('aio_checklist')
      .update({
        status: nextStatus,
        completed_at: nextStatus === 'done' ? new Date().toISOString() : null,
      })
      .eq('id', item.id);
    load();
  }

  async function removeItem(id) {
    await supabase.from('aio_checklist').delete().eq('id', id);
    load();
  }

  return (
    <div>
      <h2 className="mb-3 text-sm font-medium text-ink">Checklist</h2>

      <form onSubmit={addItem} className="mb-4 flex flex-wrap gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New task"
          className="min-w-[140px] flex-1 rounded border border-border bg-surface px-2 py-1.5 text-sm text-ink placeholder:text-muted"
        />
        <input
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          placeholder="Tag (School · Maths)"
          className="w-40 rounded border border-border bg-surface px-2 py-1.5 text-sm text-ink placeholder:text-muted"
        />
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="rounded border border-border bg-surface px-2 py-1.5 text-sm text-ink"
        />
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="rounded border border-border bg-surface px-2 py-1.5 text-sm text-ink"
        >
          <option value="low">Low</option>
          <option value="med">Med</option>
          <option value="high">High</option>
        </select>
        <button
          type="submit"
          className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-white"
        >
          Add
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted">Nothing on the list yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded border border-border bg-surface">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 px-3 py-2">
              <input
                type="checkbox"
                checked={item.status === 'done'}
                onChange={() => toggleDone(item)}
                className="h-4 w-4"
              />
              <span className={`h-1.5 w-1.5 rounded-full ${PRIORITY_DOT[item.priority]}`} />
              <span
                className={`flex-1 text-sm ${
                  item.status === 'done' ? 'text-muted line-through' : 'text-ink'
                }`}
              >
                {item.title}
              </span>
              <span className="text-xs text-muted">{item.tag}</span>
              {item.due_date && (
                <span className="font-mono text-xs text-muted">{item.due_date}</span>
              )}
              <button
                onClick={() => removeItem(item.id)}
                className="text-xs text-muted hover:text-bad"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
