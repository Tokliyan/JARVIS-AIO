import { useEffect, useState } from 'react';

// Shown while a guide is being written (a full guide takes a minute or two).
// The stages are paced by time, not reported by the server: they say what is
// happening in general, so nobody stares at a frozen button.

const STAGES = [
  [0, 'Reading your notes'],
  [6, 'Working out what is examinable'],
  [15, 'Organising it into topics'],
  [30, 'Writing explanations and key terms'],
  [55, 'Adding worked examples and common mistakes'],
  [85, 'Writing questions to test yourself'],
  [120, 'Nearly there, long notes take a little longer'],
];

export default function GuideProgress({ subject, title, startedAt, error, onDismiss }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (error) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [error]);

  if (error) {
    return (
      <div className="mb-5 flex items-start justify-between gap-3 rounded border border-bad/40 bg-bad/5 px-4 py-3" role="alert">
        <div className="text-sm text-ink">
          <div className="font-medium">The study guide didn&apos;t work</div>
          <div className="mt-0.5 text-muted">{error} Your notes were still saved in Notes.</div>
        </div>
        <button onClick={onDismiss} className="shrink-0 text-xs text-muted hover:text-ink">
          Dismiss
        </button>
      </div>
    );
  }

  const secs = Math.floor((now - startedAt) / 1000);
  const stage = [...STAGES].reverse().find(([t]) => secs >= t)[1];
  const pct = Math.min(95, Math.round((1 - Math.exp(-secs / 45)) * 100));

  return (
    <div className="mb-5 rounded border border-accent/40 bg-accent/5 px-4 py-3" role="status" aria-live="polite">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0 text-sm text-ink">
          <span className="font-medium">Making your study guide</span>
          <span className="text-muted">
            {' '}
            · {subject}
            {title ? ` · ${title}` : ''}
          </span>
        </div>
        <span className="shrink-0 font-mono text-2xs text-muted">{secs}s</span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-border">
        <div className="h-full rounded-full bg-accent transition-all duration-1000" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1.5 animate-pulse-soft text-xs text-muted">{stage}…</div>
      <div className="mt-1 text-2xs text-faint">You can keep using Studyboy while it&apos;s made.</div>
    </div>
  );
}
