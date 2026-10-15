import { useEffect, useRef, useState } from 'react';
import { recordAttempts } from '@/lib/attempts';

// A timed practice test: sit it under exam conditions. The clock runs, nothing
// is marked until you submit (or time runs out), and unanswered questions count
// as wrong. Afterwards: score, time used, a topic breakdown and a full review.

function clock(totalSeconds) {
  const s = Math.max(0, totalSeconds);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export default function PracticeTest({ questions, subject, minutes, onRecorded }) {
  const total = Math.max(1, Math.round((minutes || Math.round(questions.length * 1.5)) * 60));

  const [stage, setStage] = useState('ready'); // ready | running | done
  const [answers, setAnswers] = useState({});
  const [remaining, setRemaining] = useState(total);
  const [used, setUsed] = useState(0);
  const deadline = useRef(0);
  const finished = useRef(false);
  const answersRef = useRef(answers);
  answersRef.current = answers;

  // Tick from a fixed deadline, not by counting, so a throttled background tab
  // can't hand out free time.
  useEffect(() => {
    if (stage !== 'running') return undefined;
    const id = setInterval(() => {
      const left = Math.ceil((deadline.current - Date.now()) / 1000);
      setRemaining(Math.max(0, left));
      if (left <= 0) finish(true);
    }, 500);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  function begin() {
    finished.current = false;
    deadline.current = Date.now() + total * 1000;
    setAnswers({});
    setRemaining(total);
    setStage('running');
  }

  async function finish(auto = false) {
    if (finished.current) return;
    const given = answersRef.current;
    const unanswered = questions.length - Object.keys(given).length;
    if (!auto && unanswered > 0 && !window.confirm(`${unanswered} question${unanswered === 1 ? ' is' : 's are'} unanswered and will count as wrong. Submit anyway?`)) {
      return;
    }
    finished.current = true;
    setUsed(Math.min(total, Math.round(total - (deadline.current - Date.now()) / 1000)));
    setStage('done');

    const saved = await recordAttempts(
      questions.map((q, i) => ({
        subject,
        topic: q.topic,
        mode: 'practice_test',
        correct: given[i] === q.correct_index,
        question: q.question,
        user_answer: given[i] == null ? null : q.options[given[i]],
        kind: 'mc',
      })),
    );
    if (saved) onRecorded?.();
  }

  if (questions.length === 0) return <p className="text-sm text-muted">No questions generated.</p>;

  if (stage === 'ready') {
    return (
      <div className="rounded border border-border bg-bg p-5">
        <div className="text-sm text-ink">Practice test</div>
        <ul className="mt-2 space-y-1 text-sm text-muted">
          <li>
            <span className="font-mono text-ink">{questions.length}</span> multiple-choice questions
          </li>
          <li>
            <span className="font-mono text-ink">{Math.round(total / 60)}</span> minutes, and the clock doesn&apos;t pause
          </li>
          <li>No answers or feedback until you submit</li>
          <li>Unanswered questions count as wrong</li>
        </ul>
        <button onClick={begin} className="mt-4 rounded bg-accent px-4 py-2 text-sm font-medium text-white">
          Start the clock
        </button>
      </div>
    );
  }

  const done = stage === 'done';
  const score = questions.filter((q, i) => answers[i] === q.correct_index).length;
  const answered = Object.keys(answers).length;
  const low = remaining <= 60;

  const byTopic = {};
  if (done) {
    questions.forEach((q, i) => {
      const t = q.topic || 'General';
      byTopic[t] ||= { right: 0, total: 0 };
      byTopic[t].total += 1;
      if (answers[i] === q.correct_index) byTopic[t].right += 1;
    });
  }

  return (
    <div>
      {done ? (
        <div className="mb-5 rounded border border-border bg-bg p-4">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-2xl text-ink">
              {score} / {questions.length}
            </span>
            <span className="font-mono text-sm text-muted">{Math.round((score / questions.length) * 100)}%</span>
            <span className="ml-auto text-xs text-muted">
              {clock(used)} of {clock(total)} used
            </span>
          </div>
          <ul className="mt-3 flex flex-col gap-1 text-xs">
            {Object.entries(byTopic)
              .sort((a, b) => a[1].right / a[1].total - b[1].right / b[1].total)
              .map(([topic, v]) => (
                <li key={topic} className="flex items-center gap-2">
                  <span className="w-40 truncate text-ink sm:w-56">{topic}</span>
                  <span className="h-1.5 w-24 overflow-hidden rounded bg-surface">
                    <span
                      className={`block h-full ${v.right / v.total >= 0.8 ? 'bg-good' : v.right / v.total >= 0.5 ? 'bg-warn' : 'bg-bad'}`}
                      style={{ width: `${(v.right / v.total) * 100}%` }}
                    />
                  </span>
                  <span className="font-mono text-muted">
                    {v.right}/{v.total}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      ) : (
        <div className="sticky top-0 z-10 -mx-1 mb-4 flex items-center justify-between rounded border border-border bg-surface px-3 py-2">
          <span className={`font-mono text-lg ${low ? 'text-bad' : 'text-ink'}`} aria-live="off">
            {clock(remaining)}
          </span>
          <span className="text-xs text-muted">
            {answered}/{questions.length} answered
          </span>
          <button
            onClick={() => finish(false)}
            className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-white"
          >
            Submit
          </button>
        </div>
      )}

      <ol className="flex flex-col gap-5">
        {questions.map((q, i) => {
          const chosen = answers[i];
          const right = chosen === q.correct_index;
          return (
            <li key={i}>
              <div className="mb-2 flex gap-2 text-sm text-ink">
                <span className="font-mono text-xs text-muted">{i + 1}.</span>
                <span>{q.question}</span>
              </div>
              <div className="flex flex-col gap-1.5 pl-6">
                {q.options.map((opt, oi) => {
                  const selected = chosen === oi;
                  let cls = 'border-border hover:bg-bg';
                  if (done) {
                    if (oi === q.correct_index) cls = 'border-good/50 bg-good/5';
                    else if (selected) cls = 'border-bad/50 bg-bad/5';
                    else cls = 'border-border opacity-60';
                  } else if (selected) {
                    cls = 'border-accent bg-accent/5';
                  }
                  return (
                    <button
                      key={oi}
                      onClick={() => !done && setAnswers((a) => ({ ...a, [i]: oi }))}
                      disabled={done}
                      className={`rounded border px-3 py-1.5 text-left text-sm text-ink transition-colors ${cls}`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
              {done && (
                <p className={`mt-2 pl-6 text-xs ${right ? 'text-muted' : 'text-ink'}`}>
                  {chosen == null && <span className="text-bad">Not answered. </span>}
                  {q.explanation}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      {done && (
        <button
          onClick={begin}
          className="mt-5 rounded border border-border px-3 py-2 text-sm text-ink hover:bg-bg"
        >
          Sit it again
        </button>
      )}
    </div>
  );
}
