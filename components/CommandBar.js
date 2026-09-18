import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabaseClient';

function isoDaysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export default function CommandBar() {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const inputRef = useRef(null);

  // Cmd+K / Ctrl+K focuses the bar from anywhere
  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape') setResult(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    const text = value.trim();
    if (!text || busy) return;

    setBusy(true);
    setResult(null);

    try {
      const res = await fetch('/api/command/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, today: new Date().toISOString().slice(0, 10) }),
      });
      const intent = await res.json();

      if (!res.ok) {
        setResult({ kind: 'error', message: intent.error || 'Something went wrong.' });
      } else {
        await runIntent(intent);
      }
    } catch (err) {
      setResult({ kind: 'error', message: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function runIntent(intent) {
    switch (intent.action) {
      case 'add_checklist': {
        const { error } = await supabase.from('aio_checklist').insert({
          title: intent.title,
          tag: intent.tag || 'General',
          due_date: intent.due_date || null,
          priority: intent.priority || 'med',
        });
        if (error) return setResult({ kind: 'error', message: error.message });
        setResult({
          kind: 'ok',
          message: `Added: ${intent.title}${intent.due_date ? ` — due ${intent.due_date}` : ''}`,
        });
        setValue('');
        router.replace(router.asPath, undefined, { scroll: false });
        break;
      }

      case 'complete_checklist': {
        const { data } = await supabase
          .from('aio_checklist')
          .select('*')
          .ilike('title', `%${intent.match}%`)
          .neq('status', 'done')
          .limit(1);
        if (!data || data.length === 0) {
          return setResult({ kind: 'error', message: `No open task matching "${intent.match}".` });
        }
        await supabase
          .from('aio_checklist')
          .update({ status: 'done', completed_at: new Date().toISOString() })
          .eq('id', data[0].id);
        setResult({ kind: 'ok', message: `Marked done: ${data[0].title}` });
        setValue('');
        router.replace(router.asPath, undefined, { scroll: false });
        break;
      }

      case 'add_period': {
        const { error } = await supabase.from('aio_timetable').insert({
          subject: intent.subject,
          day_of_week: intent.day_of_week,
          period_number: intent.period_number || 1,
          start_time: intent.start_time,
          end_time: intent.end_time,
          room: intent.room || null,
        });
        if (error) return setResult({ kind: 'error', message: error.message });
        setResult({ kind: 'ok', message: `Added ${intent.subject} to the timetable.` });
        setValue('');
        router.replace(router.asPath, undefined, { scroll: false });
        break;
      }

      case 'summary': {
        const target = intent.scope === 'tomorrow' ? isoDaysFromNow(1) : isoDaysFromNow(0);
        const dayNum = new Date(target).getDay();

        const [{ data: tasks }, { data: periods }] = await Promise.all([
          supabase.from('aio_checklist').select('*').eq('due_date', target),
          supabase.from('aio_timetable').select('*').eq('day_of_week', dayNum).order('period_number'),
        ]);

        setResult({
          kind: 'summary',
          scope: intent.scope,
          date: target,
          tasks: tasks || [],
          periods: periods || [],
        });
        break;
      }

      default:
        setResult({
          kind: 'error',
          message: intent.reason || "Didn't catch that — try rephrasing.",
        });
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-0 border-t border-border bg-surface/95 backdrop-blur">
      <div className="mx-auto max-w-3xl px-4 py-3">
        {result && (
          <div className="mb-2 rounded border border-border bg-bg p-3 text-sm">
            {result.kind === 'summary' ? (
              <>
                <div className="mb-2 font-mono text-xs text-muted">
                  {result.scope === 'tomorrow' ? 'Tomorrow' : 'Today'} · {result.date}
                </div>
                {result.periods.length > 0 && (
                  <div className="mb-2">
                    {result.periods.map((p) => (
                      <div key={p.id} className="flex gap-3 text-ink">
                        <span className="w-12 font-mono text-xs text-muted">
                          {p.start_time?.slice(0, 5)}
                        </span>
                        {p.subject}
                      </div>
                    ))}
                  </div>
                )}
                {result.tasks.length > 0 ? (
                  result.tasks.map((t) => (
                    <div key={t.id} className="flex gap-2 text-ink">
                      <span className="text-muted">{t.status === 'done' ? '☑' : '☐'}</span>
                      {t.title}
                      <span className="ml-auto text-xs text-muted">{t.tag}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-muted">Nothing due.</div>
                )}
              </>
            ) : (
              <span className={result.kind === 'error' ? 'text-bad' : 'text-ink'}>
                {result.message}
              </span>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex items-center gap-3">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={busy}
            placeholder={
              busy ? 'Working…' : 'Add this to the timetable, give me a summary for tomorrow…'
            }
            className="flex-1 rounded border border-border bg-bg px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-60"
          />
          <kbd className="hidden shrink-0 rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted sm:block">
            ⌘K
          </kbd>
        </form>
      </div>
    </div>
  );
}
