import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

const KINDS = [
  { id: 'shipped', label: 'Shipped', dot: 'bg-good' },
  { id: 'milestone', label: 'Milestone', dot: 'bg-accent' },
  { id: 'issue', label: 'Issue', dot: 'bg-bad' },
  { id: 'note', label: 'Note', dot: 'bg-border' },
];

function weeksAgoBuckets(updates, weeks = 8) {
  const now = new Date();
  return Array.from({ length: weeks }, (_, i) => {
    const start = new Date(now);
    start.setDate(start.getDate() - (weeks - i) * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return updates.filter((u) => {
      const d = new Date(u.created_at);
      return d >= start && d < end;
    }).length;
  });
}

export default function ActivityTimeline({ projectId }) {
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [kind, setKind] = useState('shipped');
  const [filter, setFilter] = useState('all');
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('aio_project_updates')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    setUpdates(data || []);
    setLoading(false);
  }

  async function post(e) {
    e.preventDefault();
    if (!body.trim()) return;
    setPosting(true);
    await supabase
      .from('aio_project_updates')
      .insert({ project_id: projectId, kind, body: body.trim() });
    setBody('');
    setPosting(false);
    load();
  }

  async function remove(id) {
    await supabase.from('aio_project_updates').delete().eq('id', id);
    load();
  }

  const shown = filter === 'all' ? updates : updates.filter((u) => u.kind === filter);
  const buckets = weeksAgoBuckets(updates);
  const peak = Math.max(...buckets, 1);

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={post} className="rounded border border-border bg-surface p-3">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          placeholder="What happened? e.g. fixed Module 3 field mapping"
          className="w-full resize-none rounded border border-border bg-bg px-3 py-2 text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <div className="mt-2 flex items-center gap-2">
          <div className="flex gap-1">
            {KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => setKind(k.id)}
                className={`rounded px-2.5 py-1 text-xs transition-colors ${
                  kind === k.id
                    ? 'bg-ink text-white'
                    : 'border border-border text-muted hover:text-ink'
                }`}
              >
                {k.label}
              </button>
            ))}
          </div>
          <button
            type="submit"
            disabled={posting || !body.trim()}
            className="ml-auto rounded bg-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {posting ? 'Posting…' : 'Post'}
          </button>
        </div>
      </form>

      {updates.length > 0 && (
        <div>
          <div className="mb-2 text-2xs uppercase tracking-wider text-faint">
            Activity, last 8 weeks
          </div>
          <div className="flex h-12 items-end gap-1">
            {buckets.map((n, i) => (
              <div
                key={i}
                title={`${n} update${n === 1 ? '' : 's'}`}
                className="flex-1 rounded-sm bg-accent/70 transition-all hover:bg-accent"
                style={{ height: `${Math.max((n / peak) * 100, 4)}%` }}
              />
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="mb-3 flex gap-1">
          <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>
            All {updates.length > 0 && `(${updates.length})`}
          </FilterChip>
          {KINDS.map((k) => {
            const n = updates.filter((u) => u.kind === k.id).length;
            if (n === 0) return null;
            return (
              <FilterChip key={k.id} active={filter === k.id} onClick={() => setFilter(k.id)}>
                {k.label} ({n})
              </FilterChip>
            );
          })}
        </div>

        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : shown.length === 0 ? (
          <p className="text-sm text-muted">
            Nothing logged yet. Post an update above to start the timeline.
          </p>
        ) : (
          <ul className="relative flex flex-col pl-5">
            <div className="absolute left-[3px] top-2 bottom-2 w-px bg-rule" aria-hidden="true" />
            {shown.map((u, i) => {
              const k = KINDS.find((x) => x.id === u.kind) || KINDS[3];
              return (
                <li
                  key={u.id}
                  className="group relative animate-row-in py-2.5"
                  style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
                >
                  <span
                    className={`absolute h-1.5 w-1.5 rounded-full ${k.dot}`}
                    style={{ left: '-1.19rem', top: '1rem' }}
                  />
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs text-muted">{k.label}</span>
                    <span className="tnum text-xs text-faint">
                      {new Date(u.created_at).toLocaleDateString('en-AU', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                    <button
                      onClick={() => remove(u.id)}
                      className="ml-auto text-xs text-faint opacity-0 transition-opacity hover:text-bad group-hover:opacity-100"
                    >
                      Delete
                    </button>
                  </div>
                  <p className="mt-0.5 max-w-prose text-sm leading-relaxed text-ink">{u.body}</p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`rounded px-2.5 py-1 text-xs transition-colors ${
        active ? 'bg-bg font-medium text-ink' : 'text-muted hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}
