import { useState } from 'react';
import { recordAttempts } from '@/lib/attempts';

export default function Quiz({ questions, subject, onRecorded }) {
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);

  // One row per question, so weak topics build up across every quiz taken.
  async function mark() {
    setSubmitted(true);
    const saved = await recordAttempts(
      questions.map((q, i) => ({
        subject,
        topic: q.topic,
        mode: 'quiz',
        correct: answers[i] === q.correct_index,
      })),
    );
    if (saved) onRecorded?.();
  }

  if (questions.length === 0) return <p className="text-sm text-muted">No questions generated.</p>;

  const score = questions.filter((q, i) => answers[i] === q.correct_index).length;
  const allAnswered = Object.keys(answers).length === questions.length;

  const weakTopics = submitted
    ? [
        ...new Set(
          questions.filter((q, i) => answers[i] !== q.correct_index).map((q) => q.topic),
        ),
      ].filter(Boolean)
    : [];

  return (
    <div>
      {submitted && (
        <div className="mb-4 rounded border border-border bg-bg p-3">
          <div className="font-mono text-lg text-ink">
            {score} / {questions.length}
          </div>
          {weakTopics.length > 0 ? (
            <p className="mt-1 text-xs text-muted">
              Worth another look: {weakTopics.join(', ')}
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted">Everything correct.</p>
          )}
        </div>
      )}

      <ol className="flex flex-col gap-5">
        {questions.map((q, i) => {
          const chosen = answers[i];
          const isCorrect = chosen === q.correct_index;
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
                  if (submitted) {
                    if (oi === q.correct_index) cls = 'border-good/50 bg-good/5';
                    else if (selected) cls = 'border-bad/50 bg-bad/5';
                    else cls = 'border-border opacity-60';
                  } else if (selected) {
                    cls = 'border-accent bg-accent/5';
                  }
                  return (
                    <button
                      key={oi}
                      onClick={() => !submitted && setAnswers({ ...answers, [i]: oi })}
                      disabled={submitted}
                      className={`rounded border px-3 py-1.5 text-left text-sm text-ink transition-colors ${cls}`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
              {submitted && (
                <p
                  className={`mt-2 pl-6 text-xs ${isCorrect ? 'text-muted' : 'text-ink'}`}
                >
                  {q.explanation}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      <div className="mt-5">
        {submitted ? (
          <button
            onClick={() => {
              setAnswers({});
              setSubmitted(false);
            }}
            className="rounded border border-border px-3 py-2 text-sm text-ink hover:bg-bg"
          >
            Try again
          </button>
        ) : (
          <button
            onClick={mark}
            disabled={!allAnswered}
            className="rounded bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {allAnswered
              ? 'Mark my answers'
              : `${Object.keys(answers).length}/${questions.length} answered`}
          </button>
        )}
      </div>
    </div>
  );
}
