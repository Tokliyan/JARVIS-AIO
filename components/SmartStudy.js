import { useRef, useState } from 'react';
import { authedFetch } from '@/lib/authedFetch';
import { recordAttempts, loadAttempts } from '@/lib/attempts';
import { buildMastery, focusTopics } from '@/lib/mastery';
import { addCards } from '@/lib/cards';
import { adaptLevel, checkFill, isChoiceCorrect, sessionSummary } from '@/lib/smartSession';

// Smart Study: one question at a time, from the student's own notes. A wrong
// first answer gets a guiding question rather than the answer; the answer is
// only shown after a second try (or "Show answer"). Difficulty follows how the
// session is going, weak topics get extra questions, and nothing repeats.

const KIND_LABEL = {
  mc: 'Multiple choice',
  tf: 'True or false',
  short: 'Short answer',
  fill: 'Fill the blank',
};
const LEVEL_LABEL = { easier: 'Easier', match: 'Matching your notes', harder: 'Stretching' };

function answerText(q) {
  if (q.kind === 'mc' || q.kind === 'tf') return q.options[q.correct_index];
  if (q.kind === 'short') return q.model_answer;
  return q.answer;
}

function cardFor(q) {
  const front = q.kind === 'tf' ? `True or false: ${q.question}` : q.question;
  const back = [answerText(q), q.explanation].filter(Boolean).join('\n\n');
  return { topic: q.topic, front, back };
}

export default function SmartStudy({ subject, sourceText, onGoCreate, onAttemptsRecorded }) {
  const [phase, setPhase] = useState('idle'); // idle | loading | question | summary
  const [error, setError] = useState(null);
  const [focus, setFocus] = useState([]);
  const [level, setLevel] = useState('match');
  const [results, setResults] = useState([]);
  const [deckAdds, setDeckAdds] = useState(0);

  // The question on screen.
  const [q, setQ] = useState(null);
  const [status, setStatus] = useState('answering'); // answering | hinted | revealed
  const [attempt, setAttempt] = useState(1);
  const [picked, setPicked] = useState([]); // wrong choices already tried
  const [text, setText] = useState('');
  const [hint, setHint] = useState('');
  const [feedback, setFeedback] = useState('');
  const [outcome, setOutcome] = useState(null);
  const [checking, setChecking] = useState(false);

  // Things that must be current inside async callbacks without re-rendering.
  const store = useRef({ asked: [], queue: [], level: 'match', fetching: false });

  const ready = sourceText.trim().length >= 50;

  async function fetchBatch() {
    const s = store.current;
    s.fetching = true;
    try {
      const res = await authedFetch('/api/studyboy/smart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'next',
          subject,
          sourceText,
          asked: s.asked,
          focusTopics: s.focus || [],
          level: s.level,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not get the next questions.');
      for (const nq of data.questions) s.asked.push(nq.question);
      s.queue.push(...data.questions);
    } finally {
      s.fetching = false;
    }
  }

  // Keep a question or two in hand so "Next" is instant.
  function topUp() {
    const s = store.current;
    if (s.queue.length <= 1 && !s.fetching) fetchBatch().catch(() => {});
  }

  function show(next) {
    setError(null);
    setQ(next);
    setStatus('answering');
    setAttempt(1);
    setPicked([]);
    setText('');
    setHint('');
    setFeedback('');
    setOutcome(null);
    setChecking(false);
    setPhase('question');
  }

  async function start() {
    setError(null);
    setPhase('loading');
    setResults([]);
    setDeckAdds(0);
    setLevel('match');

    const s = store.current;
    s.asked = [];
    s.queue = [];
    s.level = 'match';
    try {
      const att = await loadAttempts(subject);
      s.focus = att ? focusTopics(buildMastery(att.rows)) : [];
      setFocus(s.focus);
      await fetchBatch();
      show(s.queue.shift());
      topUp();
    } catch (err) {
      setError(err.message);
      setPhase('idle');
    }
  }

  async function next() {
    const s = store.current;
    if (s.queue.length === 0) {
      setPhase('loading');
      try {
        if (s.fetching) {
          while (s.fetching) await new Promise((r) => setTimeout(r, 200));
        } else {
          await fetchBatch();
        }
      } catch (err) {
        setError(err.message);
        setPhase('summary');
        return;
      }
    }
    const nq = s.queue.shift();
    if (!nq) {
      setError('No more questions came back. Try again in a moment.');
      setPhase('summary');
      return;
    }
    show(nq);
    topUp();
  }

  // firstTry = right without a nudge (what mastery counts); correct = got there eventually.
  function reveal({ firstTry, correct, userAnswer, hintUsed, fb }) {
    const s = store.current;
    setOutcome({ firstTry, correct });
    if (fb) setFeedback(fb);
    setStatus('revealed');

    const nextResults = [...results, { firstTry, topic: q.topic, level: s.level }];
    setResults(nextResults);
    const nextLevel = adaptLevel(s.level, nextResults);
    s.level = nextLevel;
    setLevel(nextLevel);

    recordAttempts([
      {
        subject,
        topic: q.topic,
        mode: 'smart_study',
        correct: firstTry,
        question: q.question,
        user_answer: userAnswer,
        kind: q.kind,
        hint_used: hintUsed,
      },
    ]).then((ok) => ok && onAttemptsRecorded?.());

    // Anything missed goes into the review deck so it comes back on a schedule.
    if (!firstTry) {
      addCards(subject, [cardFor(q)], 'smart_study').then((r) => {
        if (r.ok && r.added) setDeckAdds((n) => n + r.added);
      });
    }
  }

  function pick(i) {
    if (status === 'revealed' || picked.includes(i)) return;
    const answer = q.options[i];
    if (isChoiceCorrect(q, i)) {
      reveal({ firstTry: attempt === 1, correct: true, userAnswer: answer, hintUsed: attempt === 2 });
    } else if (attempt === 1 && q.kind === 'mc' && q.hint) {
      // Guide, don't tell. (True/false has no second try: only one option is left.)
      setPicked([...picked, i]);
      setAttempt(2);
      setStatus('hinted');
      setHint(q.hint);
    } else {
      reveal({ firstTry: false, correct: false, userAnswer: answer, hintUsed: attempt === 2 });
    }
  }

  async function submitText() {
    const typed = text.trim();
    if (!typed || checking) return;
    setChecking(true);
    setError(null);

    if (q.kind === 'fill' && checkFill(q, typed) === true) {
      reveal({ firstTry: attempt === 1, correct: true, userAnswer: typed, hintUsed: attempt === 2 });
      setChecking(false);
      return;
    }

    try {
      const res = await authedFetch('/api/studyboy/smart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'grade',
          subject,
          question: q.question,
          kind: q.kind,
          modelAnswer: q.kind === 'fill' ? q.answer : q.model_answer,
          keyPoints: q.key_points || [],
          studentAnswer: typed,
          attempt,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not mark that.');

      if (data.verdict === 'correct') {
        reveal({ firstTry: attempt === 1, correct: true, userAnswer: typed, hintUsed: attempt === 2, fb: data.feedback });
      } else if (attempt === 1) {
        setAttempt(2);
        setStatus('hinted');
        setHint(data.guiding_question || q.hint || 'Look at your notes on this topic and try once more.');
        setFeedback(data.feedback || '');
      } else {
        reveal({ firstTry: false, correct: false, userAnswer: typed, hintUsed: true, fb: data.feedback });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setChecking(false);
    }
  }

  function showAnswer() {
    reveal({ firstTry: false, correct: false, userAnswer: null, hintUsed: attempt === 2 });
  }

  const summary = sessionSummary(results);

  // ------------------------------------------------------------ idle

  if (phase === 'idle' || phase === 'loading') {
    return (
      <div className="rounded border border-border bg-surface p-5">
        <h2 className="text-sm font-medium text-ink">Smart Study</h2>
        <p className="mt-1 max-w-xl text-sm text-muted">
          Questions come one at a time, only from your notes. Get one wrong and you get a nudge, not
          the answer. It gets harder as you get things right, leans on your weak topics, and never
          asks the same question twice.
        </p>

        {!ready ? (
          <div className="mt-4 text-sm text-muted">
            There&apos;s no {subject} material loaded yet.{' '}
            <button onClick={onGoCreate} className="text-accent hover:underline">
              Add some in Create
            </button>{' '}
            first.
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={start}
              disabled={phase === 'loading'}
              className="rounded bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {phase === 'loading' ? 'Getting your first questions…' : 'Start session'}
            </button>
            <span className="font-mono text-xs text-muted">
              {sourceText.length.toLocaleString()} characters of {subject}
            </span>
          </div>
        )}
        {error && <p className="mt-3 text-sm text-bad">{error}</p>}
      </div>
    );
  }

  // ------------------------------------------------------------ summary

  if (phase === 'summary') {
    return (
      <div className="rounded border border-border bg-surface p-5">
        <h2 className="text-sm font-medium text-ink">Session summary</h2>
        {summary.answered === 0 ? (
          <p className="mt-2 text-sm text-muted">No questions answered this time.</p>
        ) : (
          <>
            <div className="mt-3 font-mono text-2xl text-ink">
              {summary.clean} / {summary.answered}
              <span className="ml-2 text-sm text-muted">right first try</span>
            </div>
            {summary.missed.length > 0 ? (
              <p className="mt-2 text-sm text-muted">Worth another look: {summary.missed.join(', ')}</p>
            ) : (
              <p className="mt-2 text-sm text-muted">Clean sheet.</p>
            )}
            {deckAdds > 0 && (
              <p className="mt-1 text-xs text-muted">
                {deckAdds} missed question{deckAdds === 1 ? '' : 's'} added to your review deck.
              </p>
            )}
          </>
        )}
        {error && <p className="mt-3 text-sm text-bad">{error}</p>}
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => (summary.answered || store.current.queue.length ? next() : start())}
            className="rounded bg-accent px-4 py-2 text-sm font-medium text-white"
          >
            Keep going
          </button>
          <button onClick={start} className="rounded border border-border px-4 py-2 text-sm text-ink hover:bg-bg">
            New session
          </button>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------ question

  const revealed = status === 'revealed';
  const isChoice = q.kind === 'mc' || q.kind === 'tf';

  return (
    <div className="rounded border border-border bg-surface p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <div className="flex items-center gap-3">
          <span className="font-mono">
            {summary.clean} / {summary.answered} first try
          </span>
          <span>{LEVEL_LABEL[level]}</span>
        </div>
        <button onClick={() => setPhase('summary')} className="text-accent hover:underline">
          End session
        </button>
      </div>

      {focus.length > 0 && results.length === 0 && (
        <p className="mb-3 text-xs text-muted">Leaning on your weaker topics: {focus.join(', ')}</p>
      )}

      <div className="mb-2 flex items-center gap-2 text-[11px] text-muted">
        <span className="rounded bg-bg px-1.5 py-0.5">{KIND_LABEL[q.kind]}</span>
        <span>{q.topic}</span>
      </div>
      <p className="mb-4 text-sm leading-relaxed text-ink">
        {q.kind === 'tf' ? <span className="text-muted">True or false: </span> : null}
        {q.question}
      </p>

      {isChoice && (
        <div className="flex flex-col gap-1.5">
          {q.options.map((opt, oi) => {
            const wrongTried = picked.includes(oi);
            let cls = 'border-border hover:bg-bg';
            if (revealed) {
              if (oi === q.correct_index) cls = 'border-good/50 bg-good/5';
              else if (wrongTried) cls = 'border-bad/50 bg-bad/5';
              else cls = 'border-border opacity-60';
            } else if (wrongTried) {
              cls = 'border-bad/40 bg-bad/5 opacity-60';
            }
            return (
              <button
                key={oi}
                onClick={() => pick(oi)}
                disabled={revealed || wrongTried}
                className={`rounded border px-3 py-2 text-left text-sm text-ink transition-colors ${cls}`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      )}

      {!isChoice && (
        <div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={revealed || checking}
            rows={q.kind === 'short' ? 4 : 1}
            placeholder={q.kind === 'short' ? 'Answer in your own words…' : 'Type the missing word or phrase…'}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && q.kind === 'fill') {
                e.preventDefault();
                submitText();
              }
            }}
            className="w-full rounded border border-border bg-bg px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-60"
          />
          {!revealed && (
            <button
              onClick={submitText}
              disabled={!text.trim() || checking}
              className="mt-2 rounded bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {checking ? 'Checking…' : attempt === 2 ? 'Try again' : 'Check answer'}
            </button>
          )}
        </div>
      )}

      {status === 'hinted' && (
        <div className="mt-4 rounded border border-accent/30 bg-accent/5 p-3 text-sm text-ink">
          {feedback && <p className="mb-1 text-muted">{feedback}</p>}
          <p>
            <span className="font-medium">Think about this: </span>
            {hint}
          </p>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-bad">{error}</p>}

      {revealed && (
        <div className="mt-4 rounded border border-border bg-bg p-3 text-sm">
          <p className={outcome?.correct ? 'font-medium text-good' : 'font-medium text-ink'}>
            {outcome?.firstTry ? 'Correct' : outcome?.correct ? 'Got it, with a nudge' : 'Not this time'}
          </p>
          <p className="mt-1 text-ink">
            <span className="text-muted">Answer: </span>
            {answerText(q)}
          </p>
          {feedback && <p className="mt-1 text-muted">{feedback}</p>}
          {q.explanation && <p className="mt-1 text-xs text-muted">{q.explanation}</p>}
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        {revealed ? (
          <button onClick={next} className="rounded bg-accent px-4 py-2 text-sm font-medium text-white">
            Next question
          </button>
        ) : (
          <button onClick={showAnswer} className="text-xs text-muted hover:text-ink hover:underline">
            Show answer
          </button>
        )}
      </div>
    </div>
  );
}
