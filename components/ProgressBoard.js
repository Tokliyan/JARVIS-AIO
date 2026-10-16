import { useEffect, useState } from 'react';
import { loadAttempts } from '@/lib/attempts';
import { loadDeck } from '@/lib/cards';
import { summariseDeck } from '@/lib/srs';
import {
  STATUS_LABEL,
  STATUS_ORDER,
  activitySummary,
  buildMastery,
  groupByStatus,
} from '@/lib/mastery';

// What's mastered, what's improving, what needs another pass — per topic, from
// every quiz, flashcard, Smart Study and practice-test answer — plus a record
// of each question answered.

const BAR = {
  needs_work: 'bg-bad',
  improving: 'bg-warn',
  new: 'bg-faint',
  mastered: 'bg-good',
};
const MODE_LABEL = {
  quiz: 'Quiz',
  flashcards: 'Cards',
  smart_study: 'Smart Study',
  practice_test: 'Practice test',
};

function ago(iso) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return days < 30 ? `${days}d ago` : new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

export default function ProgressBoard({ subject, refreshKey = 0, onStudyWeak }) {
  const [data, setData] = useState(undefined); // undefined = loading, null = unavailable
  const [deck, setDeck] = useState(null);
  const [filter, setFilter] = useState('all'); // all | missed

  useEffect(() => {
    let live = true;
    (async () => {
      const [att, d] = await Promise.all([loadAttempts(subject), loadDeck(subject)]);
      if (!live) return;
      setData(att);
      setDeck(d.ok ? summariseDeck(d.cards) : null);
    })();
    return () => {
      live = false;
    };
  }, [subject, refreshKey]);

  if (data === undefined) return <p className="text-sm text-muted">Loading your progress…</p>;

  if (data === null) {
    return (
      <div className="rounded border border-border bg-surface p-5 text-sm text-muted">
        Progress tracking needs <span className="font-mono text-ink">pending-sql/001_aio_studyboy_attempts.sql</span>{' '}
        (and <span className="font-mono text-ink">006</span> for the question history) run in the Supabase SQL
        Editor.
      </div>
    );
  }

  if (data.rows.length === 0) {
    return (
      <div className="rounded border border-border bg-surface p-5 text-sm text-muted">
        Nothing to show for {subject} yet. Answer some questions in Smart Study, take a quiz or review
        flashcards and your progress builds up here.
      </div>
    );
  }

  const mastery = buildMastery(data.rows);
  const groups = groupByStatus(mastery);
  const week = activitySummary(data.rows, 7);
  const history = data.rows
    .filter((r) => r.question)
    .filter((r) => filter === 'all' || !r.correct)
    .slice(0, 60);
  const struggling = groups.needs_work.length + groups.improving.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="This week" value={week.questions} sub="questions" />
        <Stat
          label="Accuracy"
          value={week.accuracy == null ? '—' : `${Math.round(week.accuracy * 100)}%`}
          sub="last 7 days"
        />
        <Stat label="Mastered" value={groups.mastered.length} sub={`of ${mastery.length} topics`} />
        <Stat
          label="Due to review"
          value={deck ? deck.due : '—'}
          sub={deck ? `${deck.total} in deck` : 'deck not set up'}
        />
      </div>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium text-ink">Topics</h2>
          {struggling && onStudyWeak && (
            <button onClick={onStudyWeak} className="text-xs text-accent hover:underline">
              Practise the weak ones in Smart Study →
            </button>
          )}
        </div>
        <div className="flex flex-col gap-4">
          {STATUS_ORDER.filter((s) => groups[s].length > 0).map((s) => (
            <div key={s}>
              <div className="mb-1.5 text-xs text-muted">
                {STATUS_LABEL[s]} <span className="font-mono">({groups[s].length})</span>
              </div>
              <ul className="flex flex-col divide-y divide-border rounded border border-border bg-surface">
                {groups[s].map((t) => (
                  <li key={t.topic} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <span className="min-w-0 flex-1 truncate text-ink">{t.topic}</span>
                    <span className="h-1.5 w-24 shrink-0 overflow-hidden rounded bg-bg">
                      <span
                        className={`block h-full ${BAR[s]}`}
                        style={{ width: `${Math.round(t.accuracy * 100)}%` }}
                      />
                    </span>
                    <span className="w-24 shrink-0 text-right font-mono text-xs text-muted">
                      {Math.round(t.accuracy * 100)}% · {t.attempts}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium text-ink">Question history</h2>
          {data.hasQuestions && (
            <div className="flex gap-1">
              {[
                ['all', 'All'],
                ['missed', 'Missed'],
              ].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setFilter(id)}
                  className={`rounded border px-2.5 py-1 text-xs transition-colors ${
                    filter === id ? 'border-accent bg-accent text-white' : 'border-border text-ink hover:bg-bg'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {!data.hasQuestions ? (
          <p className="text-xs text-muted">
            Individual questions are only kept once{' '}
            <span className="font-mono text-ink">pending-sql/006_aio_studyboy_review.sql</span> has been run.
          </p>
        ) : history.length === 0 ? (
          <p className="text-xs text-muted">
            {filter === 'missed' ? 'Nothing missed. Nice.' : 'No questions recorded yet.'}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded border border-border bg-surface">
            {history.map((r) => (
              <li key={r.id} className="flex gap-3 px-3 py-2">
                <span className={`mt-0.5 text-sm ${r.correct ? 'text-good' : 'text-bad'}`} aria-label={r.correct ? 'Correct' : 'Missed'}>
                  {r.correct ? '✓' : '✗'}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-ink">{r.question}</div>
                  <div className="mt-0.5 text-xs text-muted">
                    {[r.topic, MODE_LABEL[r.mode], r.hint_used ? 'needed a hint' : null, ago(r.created_at)]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                  {!r.correct && r.user_answer && (
                    <div className="mt-0.5 text-xs text-muted">You said: {r.user_answer}</div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, sub }) {
  return (
    <div className="rounded border border-border bg-surface px-3 py-2.5">
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-0.5 font-mono text-xl text-ink">{value}</div>
      <div className="text-[11px] text-muted">{sub}</div>
    </div>
  );
}
