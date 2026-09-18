import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

const STATUS = {
  done: { label: 'Done', dot: 'bg-good', text: 'text-faint line-through' },
  in_progress: { label: 'In progress', dot: 'bg-accent', text: 'text-ink' },
  planned: { label: 'Planned', dot: 'bg-border', text: 'text-muted' },
};
const ORDER = ['in_progress', 'planned', 'done'];

export default function RoadmapEditor({ project, onChange }) {
  const [items, setItems] = useState(Array.isArray(project.roadmap) ? project.roadmap : []);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('planned');
  const [detail, setDetail] = useState('');
  const [saving, setSaving] = useState(false);

  async function persist(next) {
    setItems(next);
    setSaving(true);
    await supabase
      .from('aio_projects')
      .update({ roadmap: next, updated_at: new Date().toISOString() })
      .eq('id', project.id);
    setSaving(false);
    onChange?.();
  }

  function add(e) {
    e.preventDefault();
    if (!title.trim()) return;
    persist([...items, { title: title.trim(), status, detail: detail.trim() || undefined }]);
    setTitle('');
    setDetail('');
    setStatus('planned');
  }

  function setItemStatus(i, next) {
    persist(items.map((it, idx) => (idx === i ? { ...it, status: next } : it)));
  }

  function remove(i) {
    persist(items.filter((_, idx) => idx !== i));
  }

  const sorted = [...items]
    .map((it, i) => ({ ...it, _i: i }))
    .sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status));

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-ink">Roadmap</h2>
        <button onClick={() => setEditing((s) => !s)} className="text-xs text-accent">
          {editing ? 'Done editing' : 'Edit'}
        </button>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-muted">No roadmap items yet.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {sorted.map((it) => (
            <li key={it._i} className="group flex items-start gap-2.5">
              <span
                className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${STATUS[it.status]?.dot || STATUS.planned.dot}`}
              />
              <div className="min-w-0 flex-1">
                <div className={`text-sm ${STATUS[it.status]?.text || 'text-ink'}`}>{it.title}</div>
                {it.detail && <div className="text-xs text-faint">{it.detail}</div>}
              </div>
              {editing ? (
                <div className="flex shrink-0 items-center gap-1.5">
                  <select
                    value={it.status}
                    onChange={(e) => setItemStatus(it._i, e.target.value)}
                    className="rounded border border-border bg-surface px-1.5 py-0.5 text-xs"
                  >
                    {Object.entries(STATUS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => remove(it._i)}
                    className="text-xs text-faint hover:text-bad"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <span className="shrink-0 text-2xs text-faint">
                  {STATUS[it.status]?.label}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <form onSubmit={add} className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="New roadmap item"
            className="min-w-[10rem] flex-1 rounded border border-border bg-surface px-2 py-1.5 text-sm"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded border border-border bg-surface px-2 py-1.5 text-sm"
          >
            {Object.entries(STATUS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
          <input
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="Detail (optional)"
            className="min-w-[10rem] flex-1 rounded border border-border bg-surface px-2 py-1.5 text-sm"
          />
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            Add
          </button>
        </form>
      )}
    </div>
  );
}
