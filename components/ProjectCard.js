import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Tile from '@/components/Tile';

const DOT = { good: 'bg-good', warn: 'bg-warn', bad: 'bg-bad', idle: 'bg-border' };

export default function ProjectCard({ project, onChange }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    status_label: project.status_label || '',
    status_color: project.status_color || 'good',
    last_update: project.last_update || '',
    next_milestone: project.next_milestone || '',
  });

  async function save(e) {
    e.preventDefault();
    await supabase
      .from('aio_projects')
      .update({ ...form, updated_at: new Date().toISOString() })
      .eq('id', project.id);
    setEditing(false);
    onChange();
  }

  const links = Array.isArray(project.links) ? project.links : [];

  return (
    <div className="rounded border border-border bg-surface p-4 transition-colors hover:border-muted/40">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex gap-3">
          <Tile tag={project.name} />
          <div>
          <h2 className="text-sm font-medium text-ink">{project.name}</h2>
          <div className="mt-1 flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${DOT[project.status_color] || DOT.idle}`} />
            <span className="text-xs text-muted">{project.status_label}</span>
          </div>
          </div>
        </div>
        <button
          onClick={() => setEditing((s) => !s)}
          className="shrink-0 text-xs text-muted hover:text-accent"
        >
          {editing ? 'Cancel' : 'Edit'}
        </button>
      </div>

      {editing ? (
        <form onSubmit={save} className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              value={form.status_label}
              onChange={(e) => setForm({ ...form, status_label: e.target.value })}
              placeholder="Status label"
              className="flex-1 rounded border border-border bg-bg px-2 py-1.5 text-sm"
            />
            <select
              value={form.status_color}
              onChange={(e) => setForm({ ...form, status_color: e.target.value })}
              className="rounded border border-border bg-bg px-2 py-1.5 text-sm"
            >
              <option value="good">Green</option>
              <option value="warn">Amber</option>
              <option value="bad">Red</option>
              <option value="idle">Idle</option>
            </select>
          </div>
          <textarea
            value={form.last_update}
            onChange={(e) => setForm({ ...form, last_update: e.target.value })}
            placeholder="Last update"
            rows={2}
            className="rounded border border-border bg-bg px-2 py-1.5 text-sm"
          />
          <input
            value={form.next_milestone}
            onChange={(e) => setForm({ ...form, next_milestone: e.target.value })}
            placeholder="Next up"
            className="rounded border border-border bg-bg px-2 py-1.5 text-sm"
          />
          <button
            type="submit"
            className="self-start rounded bg-accent px-3 py-1.5 text-sm font-medium text-white"
          >
            Save
          </button>
        </form>
      ) : (
        <>
          {project.last_update && (
            <p className="whitespace-pre-line text-sm text-ink">{project.last_update}</p>
          )}
          {project.next_milestone && (
            <p className="mt-3 text-sm text-muted">
              <span className="text-xs uppercase tracking-wide text-muted">Next</span>
              <br />
              {project.next_milestone}
            </p>
          )}
          {links.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1 border-t border-border pt-3">
              {links.map((l) => (
                <a
                  key={l.url}
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-accent hover:underline"
                >
                  {l.label} ↗
                </a>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
