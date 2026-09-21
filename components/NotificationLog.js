import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Skeleton, SkeletonBlock } from '@/components/Skeleton';

export const NOTIFICATION_LOG_TABLE = 'aio_notification_log';

// What the command bar did with each school notification it processed. Without
// this, everything it captured vanished into saved material with no trace of
// which subjects it hit or whether a plan came out of it.

function when(iso) {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

export default function NotificationLog() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from(NOTIFICATION_LOG_TABLE)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);
    // The table arrives with pending-sql/002 — until then, say so rather than
    // pretending nothing has ever been processed.
    setAvailable(!error);
    setRows(data || []);
    setLoading(false);
  }

  async function remove(id, e) {
    e.stopPropagation();
    await supabase.from(NOTIFICATION_LOG_TABLE).delete().eq('id', id);
    load();
  }

  if (loading) {
    return (
      <SkeletonBlock label="Loading processed notifications">
        <ul className="flex flex-col divide-y divide-border rounded border border-border bg-surface">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className="flex items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="mt-1.5 h-2.5 w-1/3" />
              </div>
              <Skeleton className="h-2.5 w-10 shrink-0" />
            </li>
          ))}
        </ul>
      </SkeletonBlock>
    );
  }

  if (!available) {
    return (
      <p className="text-sm text-muted">
        Not logging yet — <code className="font-mono text-xs">pending-sql/002_aio_notification_log.sql</code>{' '}
        still needs running in Supabase. Notifications are still being processed
        normally in the meantime.
      </p>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted">
        Nothing processed yet. Paste or attach a school notification in the
        command bar and it&apos;ll show up here with what it captured.
      </p>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-border rounded border border-border bg-surface">
      {rows.map((r, i) => {
        const open = expanded === r.id;
        const subjects = Array.isArray(r.subjects) ? r.subjects : [];
        return (
          <li
            key={r.id}
            onClick={() => setExpanded(open ? null : r.id)}
            className="group flex animate-row-in cursor-pointer flex-col gap-1 px-3 py-2.5 transition-colors hover:bg-bg"
            style={{ animationDelay: `${Math.min(i * 25, 250)}ms` }}
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className={open ? 'text-sm text-ink' : 'truncate text-sm text-ink'}>
                  {r.summary || 'Notification'}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {subjects.map((s) => (
                    <span
                      key={s}
                      className="rounded bg-bg px-1.5 py-0.5 text-[10px] text-muted"
                    >
                      {s}
                    </span>
                  ))}
                  {r.checklist_count > 0 && (
                    <span className="text-2xs text-faint">
                      {r.checklist_count} task{r.checklist_count === 1 ? '' : 's'}
                    </span>
                  )}
                  {r.plan_built && (
                    <span className="text-2xs text-accent">
                      {r.plan_steps}-step plan
                    </span>
                  )}
                </div>
              </div>
              <span className="tnum shrink-0 text-2xs text-faint">{when(r.created_at)}</span>
              <button
                onClick={(e) => remove(r.id, e)}
                className="shrink-0 text-xs text-faint opacity-0 transition-opacity hover:text-bad group-hover:opacity-100"
              >
                Delete
              </button>
            </div>

            {open && r.captured_text && (
              <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded border border-border bg-bg p-2.5 font-mono text-xs leading-relaxed text-muted">
                {r.captured_text}
              </pre>
            )}
          </li>
        );
      })}
    </ul>
  );
}
