// Spaced-repetition scheduling for Studyboy's review deck. Pure functions — no
// I/O — so the schedule can be tested directly.
//
// SM-2 style: every card carries an "ease" multiplier and the number of days to
// its next review. Rating a card moves both. "Again" sends it back to the start
// of the ladder (due in 10 minutes), everything else pushes it further out.

export const RATINGS = ['again', 'hard', 'good', 'easy'];

const MINUTE = 60_000;
const DAY = 86_400_000;
const MIN_EASE = 1.3;
const START_EASE = 2.5;
const MAX_INTERVAL_DAYS = 365;
const AGAIN_DELAY_MIN = 10;

const EASE_DELTA = { again: -0.2, hard: -0.15, good: 0, easy: 0.15 };

export function newCardState(now = new Date()) {
  return {
    ease: START_EASE,
    interval_days: 0,
    reps: 0,
    lapses: 0,
    due_at: now.toISOString(),
    last_reviewed_at: null,
  };
}

/**
 * Given a card's current state and a rating, returns the new scheduling fields
 * (ease, interval_days, reps, lapses, due_at, last_reviewed_at).
 */
export function nextReview(card, rating, now = new Date()) {
  if (!RATINGS.includes(rating)) throw new Error(`Unknown rating: ${rating}`);

  const prevEase = card.ease ?? START_EASE;
  const prevInterval = card.interval_days ?? 0;
  const reps = card.reps ?? 0;
  let lapses = card.lapses ?? 0;

  const ease = Math.max(MIN_EASE, round2(prevEase + EASE_DELTA[rating]));

  if (rating === 'again') {
    lapses += 1;
    return {
      ease,
      interval_days: 0,
      reps: 0,
      lapses,
      due_at: new Date(now.getTime() + AGAIN_DELAY_MIN * MINUTE).toISOString(),
      last_reviewed_at: now.toISOString(),
    };
  }

  let days;
  if (reps === 0) {
    days = rating === 'easy' ? 3 : 1;
  } else if (reps === 1) {
    days = rating === 'hard' ? 2 : rating === 'easy' ? 6 : 3;
  } else {
    const factor = rating === 'hard' ? 1.2 : rating === 'easy' ? ease * 1.3 : ease;
    days = Math.max(prevInterval + 1, Math.round(prevInterval * factor));
  }
  days = Math.min(MAX_INTERVAL_DAYS, Math.max(1, days));

  return {
    ease,
    interval_days: days,
    reps: reps + 1,
    lapses,
    due_at: new Date(now.getTime() + days * DAY).toISOString(),
    last_reviewed_at: now.toISOString(),
  };
}

/** "10m", "3h", "4d", "2mo" — the label shown on each rating button. */
export function formatInterval(ms) {
  const mins = Math.round(ms / MINUTE);
  if (mins < 60) return `${Math.max(1, mins)}m`;
  const hours = Math.round(ms / (60 * MINUTE));
  if (hours < 24) return `${hours}h`;
  const days = Math.round(ms / DAY);
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${Math.round(days / 365)}y`;
}

/** What each rating button would schedule, e.g. { again:'10m', hard:'1d', good:'1d', easy:'3d' }. */
export function previewIntervals(card, now = new Date()) {
  const out = {};
  for (const r of RATINGS) {
    out[r] = formatInterval(new Date(nextReview(card, r, now).due_at) - now);
  }
  return out;
}

export function isDue(card, now = new Date()) {
  return new Date(card.due_at) <= now;
}

/** Cards due now, most overdue first. */
export function dueQueue(cards, now = new Date()) {
  return (cards || [])
    .filter((c) => isDue(c, now))
    .sort((a, b) => new Date(a.due_at) - new Date(b.due_at));
}

export function summariseDeck(cards, now = new Date()) {
  const list = cards || [];
  const due = list.filter((c) => isDue(c, now)).length;
  const fresh = list.filter((c) => !c.last_reviewed_at).length;
  const upcoming = list
    .filter((c) => !isDue(c, now))
    .map((c) => new Date(c.due_at))
    .sort((a, b) => a - b);
  return {
    total: list.length,
    due,
    fresh,
    nextDueAt: upcoming[0] ? upcoming[0].toISOString() : null,
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
