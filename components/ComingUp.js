import { useEffect, useState } from 'react';
import { BellRing, CalendarClock, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { buildComingUp, isoDay, studyNotifications } from '@/lib/comingUp';

// The top of Studyboy: what school has coming up, taken from the
// notifications you've pasted into the command bar, with a way straight into
// studying for each one. Notifications that aren't about a subject (excursion
// money, uniform reminders) are left out.

function when(iso) {
  const d = new Date(iso);
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

export default function ComingUp({ onPrepare, onOpenNotifications, notesBySubject = {} }) {
  const [items, setItems] = useState(null);
  const [notifs, setNotifs] = useState([]);

  useEffect(() => {
    let live = true;
    (async () => {
      const today = isoDay();
      const [check, log] = await Promise.all([
        supabase
          .from('aio_checklist')
          .select('id, title, tag, due_date, status, priority')
          .ilike('tag', 'School%')
          .gte('due_date', today)
          .order('due_date', { ascending: true })
          .limit(60),
        supabase.from('aio_notification_log').select('*').order('created_at', { ascending: false }).limit(20),
      ]);
      if (!live) return;
      setItems(buildComingUp(check.data || [], { today }));
      setNotifs(log.error ? [] : studyNotifications(log.data || [], 3));
    })();
    return () => {
      live = false;
    };
  }, []);

  if (items === null) return null;

  if (items.length === 0 && notifs.length === 0) {
    return (
      <div className="rounded border border-dashed border-border px-4 py-3 text-sm text-muted">
        Nothing from school coming up. Paste a school notification into the command bar at the bottom and any
        tests or due dates in it show up here.
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-[3fr_2fr]">
      <section className="rounded border border-border bg-surface p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-ink">
          <CalendarClock size={15} className="text-accent" /> Coming up
        </h2>
        {items.length === 0 ? (
          <p className="text-sm text-muted">Nothing due in the next four weeks.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {items.map((it) => {
              const count = notesBySubject[it.subject] || 0;
              return (
                <li key={it.id} className="flex items-center gap-3 py-2">
                  <span
                    className={`w-20 shrink-0 text-xs ${
                      it.days <= 2 ? 'font-medium text-bad' : it.days <= 7 ? 'text-warn' : 'text-muted'
                    }`}
                  >
                    {it.label}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className={`truncate text-sm ${it.assessment ? 'font-medium text-ink' : 'text-ink'}`}>
                      {it.title}
                    </div>
                    <div className="text-2xs text-muted">
                      {it.subject}
                      {count > 0 ? ` · ${count} note${count === 1 ? '' : 's'} saved` : ' · no notes saved yet'}
                    </div>
                  </div>
                  <button
                    onClick={() => onPrepare?.(it)}
                    className="flex shrink-0 items-center gap-0.5 rounded border border-border px-2.5 py-1 text-xs text-ink hover:bg-bg"
                  >
                    Study <ChevronRight size={12} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded border border-border bg-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-medium text-ink">
            <BellRing size={15} className="text-accent" /> From school
          </h2>
          <button onClick={onOpenNotifications} className="text-xs text-accent hover:underline">
            All
          </button>
        </div>
        {notifs.length === 0 ? (
          <p className="text-sm text-muted">No study updates yet.</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {notifs.map((n) => (
              <li key={n.id}>
                <div className="line-clamp-2 text-sm text-ink">{n.summary || 'Notification'}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-2xs text-muted">
                  {n.subjects.map((s) => (
                    <span key={s} className="rounded bg-bg px-1.5 py-0.5">
                      {s}
                    </span>
                  ))}
                  <span className="text-faint">{when(n.created_at)}</span>
                  {n.plan_built && <span className="text-accent">{n.plan_steps}-step plan made</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
