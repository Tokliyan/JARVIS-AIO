import { useState } from 'react';
import { recordAttempts } from '@/lib/attempts';

export default function Flashcards({ cards, subject, onRecorded }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState([]);

  if (cards.length === 0) return <p className="text-sm text-muted">No cards generated.</p>;

  const card = cards[index];
  const isLast = index === cards.length - 1;

  async function mark(gotIt) {
    setKnown((k) => [...k.filter((x) => x.i !== index), { i: index, gotIt }]);
    if (!isLast) {
      setIndex(index + 1);
      setFlipped(false);
    }
    // Every rating is an attempt — that's what makes a weak topic visible.
    const saved = await recordAttempts([
      { subject, topic: card.topic, mode: 'flashcards', correct: gotIt },
    ]);
    if (saved) onRecorded?.();
  }

  const correct = known.filter((k) => k.gotIt).length;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between text-xs text-muted">
        <span className="font-mono">
          {index + 1} / {cards.length}
        </span>
        <span>{card.topic}</span>
        <span className="font-mono">
          {correct} known · {known.length - correct} to review
        </span>
      </div>

      <button
        onClick={() => setFlipped((f) => !f)}
        className="flex min-h-[10rem] w-full flex-col items-center justify-center rounded border border-border bg-bg p-6 text-center transition-colors hover:border-muted/50"
      >
        <span className="mb-2 text-[10px] uppercase tracking-wide text-muted">
          {flipped ? 'Answer' : 'Question'}
        </span>
        <span className="text-sm leading-relaxed text-ink">
          {flipped ? card.back : card.front}
        </span>
        {!flipped && <span className="mt-4 text-xs text-muted">Click to flip</span>}
      </button>

      {flipped && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => mark(false)}
            className="flex-1 rounded border border-border px-3 py-2 text-sm text-ink hover:bg-bg"
          >
            Still learning
          </button>
          <button
            onClick={() => mark(true)}
            className="flex-1 rounded border border-good/40 bg-good/5 px-3 py-2 text-sm text-ink hover:bg-good/10"
          >
            Got it
          </button>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <button
          onClick={() => {
            setIndex(Math.max(0, index - 1));
            setFlipped(false);
          }}
          disabled={index === 0}
          className="text-xs text-muted hover:text-ink disabled:opacity-40"
        >
          ← Previous
        </button>
        <button
          onClick={() => {
            setIndex(0);
            setFlipped(false);
            setKnown([]);
          }}
          className="text-xs text-muted hover:text-ink"
        >
          Restart
        </button>
        <button
          onClick={() => {
            setIndex(Math.min(cards.length - 1, index + 1));
            setFlipped(false);
          }}
          disabled={isLast}
          className="text-xs text-muted hover:text-ink disabled:opacity-40"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
