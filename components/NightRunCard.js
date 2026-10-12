import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { latestPerSection, needsYouFor, SECTION_LABELS } from '@/lib/nightRun';

const DOT = { ok: 'bg-good', warn: 'bg-warn', fail: 'bg-bad' };

function fmtRunDate(iso) {
  if (!iso) return '';
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
}

function fmtTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', timeZone: 'Australia/Sydney' });
}

// What happened overnight: the morning check's summary, the short list of
// things only Harsh can do, and one line per job. Reads aio_night_runs
// directly — RLS lets the logged-in owner see their own rows.
export default function NightRunCard() {
  const [state, setState] = useState({ loading: true });
  const [open, setOpen] = useState(null);

  useEffect(() => {
    (async () => {
      const { data: latest, error } = await supabase
        .from('aio_night_runs')
        .select('run_date')
        .order('run_date', { ascending: false })
        .limit(1);

      if (error) {
        const missing = /aio_night_runs|schema cache|does not exist/i.test(error.message || '');
        setState({ loading: false, setupNeeded: missing, error: missing ? null : error.message });
        return;
      }
      if (!latest?.length) {
        setState({ loading: false, empty: true });
        return;
      }

      const runDate = latest[0].run_date;
      const { data: rows } = await supabase
        .from('aio_night_runs')
        .select('*')
        .eq('run_date', runDate)
        .order('created_at', { ascending: true });

      const reports = latestPerSection(rows || []);
      setState({ loading: false, runDate, reports, needs: needsYouFor(reports) });
    })();
  }, []);

  if (state.loading) return <p className="text-sm text-muted">Loading…</p>;

  if (state.setupNeeded) {
    return (
      <p className="text-sm text-muted">
        Night run isn&apos;t set up yet — run <span className="font-mono text-xs">pending-sql/005_aio_night_runs.sql</span> in
        Supabase.
      </p>
    );
  }
  if (state.error) return <p className="text-sm text-bad">Couldn&apos;t load the night run: {state.error}</p>;
  if (state.empty) return <p className="text-sm text-muted">No night run reports yet — the first lands around 6am.</p>;

  const morning = state.reports.find((r) => r.section === 'morning');
  const jobs = state.reports.filter((r) => r.section !== 'morning');

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <p className="text-sm text-ink">{morning ? morning.summary : 'Morning check hasn’t run yet — showing each job as it reported.'}</p>
        <span className="shrink-0 font-mono text-2xs text-faint">{fmtRunDate(state.runDate)}</span>
      </div>

      {state.needs.length > 0 && (
        <div className="mb-4">
          <div className="mb-1.5 font-mono text-2xs uppercase tracking-wider text-faint">Needs you</div>
          <ul className="flex flex-col gap-1.5">
            {state.needs.map((n) => (
              <li key={n} className="flex items-start gap-2 text-xs text-ink">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-warn" />
                {n}
              </li>
            ))}
          </ul>
        </div>
      )}

      <ul className="divide-y divide-border">
        {jobs.map((r) => (
          <li key={r.section}>
            <button
              type="button"
              onClick={() => setOpen(open === r.section ? null : r.section)}
              className="flex w-full items-start gap-2 py-2 text-left"
            >
              <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${DOT[r.status] || 'bg-faint'}`} />
              <span className="min-w-0 flex-1 text-xs">
                <span className="text-ink">{SECTION_LABELS[r.section] || r.section}</span>
                <span className={`block text-muted ${open === r.section ? '' : 'truncate'}`}>{r.summary}</span>
              </span>
              <span className="shrink-0 font-mono text-2xs text-faint">{fmtTime(r.created_at)}</span>
            </button>
          </li>
        ))}
        {jobs.length === 0 && <li className="py-2 text-xs text-muted">No jobs reported.</li>}
      </ul>
    </div>
  );
}
