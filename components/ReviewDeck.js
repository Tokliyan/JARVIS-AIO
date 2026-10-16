import { useEffect, useRef, useState } from 'react';
import { loadDeck, reviewCard, deleteCard } from '@/lib/cards';
import { recordAttempts } from '@/lib/attempts';
import { dueQueue, formatInterval, previewIntervals, summariseDeck } from '@/lib/srs';

// The spaced-repetition review: cards come back just before you'd forget them.
// Rate each one — Again / Hard / Good / Easy — and the card is rescheduled.

const RATING_STYLE = {
  again: 'border-bad/40 text-bad hover:bg-bad/5',
  hard: 'border-border text-ink hover:bg-bg',
  good: 'border-accent/50 text-accent hover:bg-accent/5',
  easy: 'border-good/50 text-good hover:bg-good/5',
};
const RATING_LABEL = { again: 'Again', hard: 'Hard', good: 'Good', easy: 'Easy' };

export default function ReviewDeck({ subject, onAttemptsRecorded }) {
  const [scope, setScope] = useState('subject'); // subject | all
  const [state, setState] = useState({ loading: true, unavailable: false, error: null });
  const [cards, setCards] = useState([]);
  const [queue, setQueue] = useState([]);
  const [flipped, setFlipped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const sessionStart = useRef(new Date());

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject, scope]);

  async function load() {
    setState({ loading: true, unavailable: false, error: null });
    const res = await loadDeck(scope === 'subject' ? subject : undefined);
    if (!res.ok) {
      setState({ loading: false, unavailable: res.unavailable, error: res.unavailable ? null : res.error });
      return;
    }
    const now = new Date();
    sessionStart.current = now;
    setCards(res.cards);
    setQueue(dueQueue(res.cards, now));
    setReviewed(0);
    setFlipped(false);
    setState({ loading: false, unavailable: false, error: null });
  }

  const current = queue[0];

  async function rate(rating) {
    if (!current || busy) return;
    setBusy(true);
    const res = await reviewCard(current, rating);
    if (!res.ok) {
      setState((s) => ({ ...s, error: res.error }));
      setBusy(false);
      return;
    }

    setCards((all) => all.map((c) => (c.id === current.id ? res.card : c)));
    // "Again" comes back later in this same session; anything else is done for now.
    setQueue((q) => (rating === 'again' ? [...q.slice(1), res.card] : q.slice(1)));
    setReviewed((n) => n + 1);
    setFlipped(false);
    setBusy(false);

    recordAttempts([
      {
        subject: current.subject,
        topic: current.topic,
        mode: 'flashcards',
        correct: rating !== 'again',
        question: current.front,
        kind: 'card',
      },
    ]).then((ok) => ok && onAttemptsRecorded?.());
  }

  async function remove() {
    if (!current) return;
    if (!window.confirm('Remove this card from your deck?')) return;
    if (await deleteCard(current.id)) {
      setCards((all) => all.filter((c) => c.id !== current.id));
      setQueue((q) => q.slice(1));
      setFlipped(false);
    }
  }

  if (state.loading) return <p className="text-sm text-muted">Loading your deck…</p>;

  if (state.unavailable) {
    return (
      <div className="rounded border border-border bg-surface p-5 text-sm text-muted">
        The review deck needs one setup step: run{' '}
        <span className="font-mono text-ink">pending-sql/006_aio_studyboy_review.sql</span> in the
        Supabase SQL Editor, then reload this page.
      </div>
    );
  }

  const now = new Date();
  const sum = summariseDeck(cards, now);
  const left = queue.length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-4 text-xs text-muted">
          <span>
            <span className="font-mono text-ink">{left}</span> to review
          </span>
          <span>
            <span className="font-mono text-ink">{sum.total}</span> in deck
          </span>
          <span>
            <span className="font-mono text-ink">{sum.fresh}</span> new
          </span>
          {reviewed > 0 && (
            <span>
              <span className="font-mono text-ink">{reviewed}</span> done this session
            </span>
          )}
        </div>
        <div className="flex gap-1">
          {[
            ['subject', subject],
            ['all', 'All subjects'],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setScope(id)}
              className={`rounded border px-2.5 py-1 text-xs transition-colors ${
                scope === id ? 'border-accent bg-accent text-white' : 'border-border text-ink hover:bg-bg'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {state.error && <p className="mb-3 text-sm text-bad">{state.error}</p>}

      {sum.total === 0 ? (
        <div className="rounded border border-border bg-surface p-5 text-sm text-muted">
          Your deck is empty. Make flashcards in Create and press &ldquo;Add to review deck&rdquo;, or
          miss a few questions in Smart Study and they&apos;ll land here automatically.
        </div>
      ) : !current ? (
        <div className="rounded border border-border bg-surface p-5">
          <p className="text-sm text-ink">Nothing left to review right now.</p>
          <p className="mt-1 text-xs text-muted">
            {sum.nextDueAt
              ? `Next card is due in ${formatInterval(new Date(sum.nextDueAt) - now)}.`
              : 'Every card has been reviewed.'}
          </p>
        </div>
      ) : (
        <div>
          <div className="mb-2 flex items-center justify-between text-xs text-muted">
            <span>{current.topic || 'Card'}</span>
            <span>{current.subject}</span>
          </div>
          <button
            onClick={() => setFlipped((f) => !f)}
            className="flex min-h-[10rem] w-full flex-col items-center justify-center rounded border border-border bg-surface p-6 text-center transition-colors hover:bg-bg"
          >
            <span className="mb-2 text-[11px] uppercase tracking-wide text-muted">
              {flipped ? 'Answer' : 'Question'}
            </span>
            <span className="whitespace-pre-wrap text-base leading-relaxed text-ink">
              {flipped ? current.back : current.front}
            </span>
            {!flipped && <span className="mt-4 text-xs text-muted">Think of the answer, then click to flip</span>}
          </button>

          {flipped ? (
            <div className="mt-3 grid grid-cols-4 gap-2">
              {Object.entries(previewIntervals(current, now)).map(([rating, label]) => (
                <button
                  key={rating}
                  onClick={() => rate(rating)}
                  disabled={busy}
                  className={`rounded border px-2 py-2 text-sm transition-colors disabled:opacity-50 ${RATING_STYLE[rating]}`}
                >
                  <div>{RATING_LABEL[rating]}</div>
                  <div className="font-mono text-[10px] opacity-70">{label}</div>
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-3 text-right">
              <button onClick={remove} className="text-xs text-muted hover:text-bad hover:underline">
                Remove card
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
