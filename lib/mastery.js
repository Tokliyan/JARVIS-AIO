// Turns raw quiz / flashcard / Smart Study attempts into "what do I actually
// know" — per topic: mastered, improving, needs work, or still new. Pure
// functions, no I/O.

export const STATUS_ORDER = ['needs_work', 'improving', 'new', 'mastered'];

export const STATUS_LABEL = {
  needs_work: 'Needs work',
  improving: 'Improving',
  new: 'Just started',
  mastered: 'Mastered',
};

const RECENT = 8; // only recent attempts count — old mistakes shouldn't haunt a topic forever
const MIN_ATTEMPTS = 3; // below this we don't have an opinion yet

/** rows: [{ correct: boolean, created_at }] for ONE topic, any order. */
export function topicStatus(rows) {
  const sorted = [...rows].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const attempts = sorted.length;
  const recent = sorted.slice(-RECENT);
  const right = recent.filter((r) => r.correct).length;
  const accuracy = recent.length ? right / recent.length : 0;
  const lastTwoRight = recent.length >= 2 && recent.slice(-2).every((r) => r.correct);
  const lastThreeRight = recent.length >= 3 && recent.slice(-3).every((r) => r.correct);

  let status;
  if (attempts < MIN_ATTEMPTS) status = 'new';
  else if (accuracy >= 0.85 && lastTwoRight) status = 'mastered';
  else if (accuracy < 0.6 && !lastThreeRight) status = 'needs_work';
  else status = 'improving';

  return {
    status,
    accuracy,
    attempts,
    recent: recent.length,
    lastSeen: sorted.length ? sorted[sorted.length - 1].created_at : null,
  };
}

/** rows: [{ topic, correct, created_at }] → one entry per topic, weakest first. */
export function buildMastery(rows) {
  const byTopic = new Map();
  for (const r of rows || []) {
    const topic = (r.topic || '').trim() || 'Unlabelled';
    if (!byTopic.has(topic)) byTopic.set(topic, []);
    byTopic.get(topic).push(r);
  }
  const list = [...byTopic.entries()].map(([topic, rs]) => ({ topic, ...topicStatus(rs) }));
  return list.sort(
    (a, b) =>
      STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || a.accuracy - b.accuracy,
  );
}

export function groupByStatus(mastery) {
  const out = { needs_work: [], improving: [], new: [], mastered: [] };
  for (const m of mastery) out[m.status].push(m);
  return out;
}

/** Topics Smart Study should lean on: anything not yet mastered that has been getting wrong. */
export function focusTopics(mastery, max = 4) {
  return mastery
    .filter((m) => m.topic !== 'Unlabelled' && (m.status === 'needs_work' || (m.status === 'improving' && m.accuracy < 0.75)))
    .slice(0, max)
    .map((m) => m.topic);
}

/** Last `days` days: how many questions, how many right. */
export function activitySummary(rows, days = 7, now = new Date()) {
  const cutoff = now.getTime() - days * 86_400_000;
  const recent = (rows || []).filter((r) => new Date(r.created_at).getTime() >= cutoff);
  const correct = recent.filter((r) => r.correct).length;
  return {
    questions: recent.length,
    correct,
    accuracy: recent.length ? correct / recent.length : null,
  };
}
