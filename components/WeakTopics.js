import { useEffect, useState } from 'react';
import { loadTopicAccuracy } from '@/lib/attempts';

const MIN_ATTEMPTS = 2; // one unlucky guess isn't a weak topic
const SHOWN = 5;

function tone(accuracy) {
  if (accuracy < 0.5) return 'bg-bad';
  if (accuracy < 0.8) return 'bg-warn';
  return 'bg-good';
}

export default function WeakTopics({ subject, refreshKey = 0 }) {
  const [topics, setTopics] = useState(null); // null = not available / not loaded yet

  useEffect(() => {
    let live = true;
    (async () => {
      const rows = await loadTopicAccuracy(subject);
      if (live) setTopics(rows);
    })();
    return () => {
      live = false;
    };
  }, [subject, refreshKey]);

  // No table yet (the pending SQL hasn't been run) or nothing answered for this
  // subject — either way there's nothing worth taking up space for.
  if (!topics || topics.length === 0) return null;

  const weak = topics
    .filter((t) => t.attempts >= MIN_ATTEMPTS && t.accuracy < 1)
    .sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts)
    .slice(0, SHOWN);

  const totalAttempts = topics.reduce((n, t) => n + t.attempts, 0);
  const totalCorrect = topics.reduce((n, t) => n + t.correct, 0);

  if (weak.length === 0) {
    return (
      <div className="rounded border border-border bg-surface p-4">
        <h2 className="mb-1 text-sm font-medium text-ink">Weak topics — {subject}</h2>
        <p className="text-sm text-muted">
          Nothing standing out yet — {totalCorrect}/{totalAttempts} right across{' '}
          {topics.length} topic{topics.length === 1 ? '' : 's'}.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded border border-border bg-surface p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-ink">Weak topics — {subject}</h2>
        <span className="tnum text-2xs text-faint">
          {totalCorrect}/{totalAttempts} all time
        </span>
      </div>

      <ul className="flex flex-col gap-2">
        {weak.map((t) => (
          <li key={t.topic}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
              <span className="truncate text-ink">{t.topic}</span>
              <span className="tnum shrink-0 text-muted">
                {t.correct}/{t.attempts}
              </span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-border">
              <div
                className={`h-full rounded-full ${tone(t.accuracy)}`}
                style={{ width: `${Math.round(t.accuracy * 100)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-2xs text-faint">
        From every quiz marked and flashcard rated. Worth pointing your next
        generate at these.
      </p>
    </div>
  );
}
