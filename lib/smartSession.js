// Small pure helpers behind the Smart Study session UI — kept out of the
// component so the rules (what counts as correct, when the level moves) can be
// tested without a browser.

export const LEVELS = ['easier', 'match', 'harder'];

export function normalizeAnswer(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // accents: "é" vs "e" shouldn't cost a mark
    .replace(/[^a-z0-9\s.%-]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.-]+|[\s.-]+$/g, '') // a full stop at the end isn't part of the answer, but 3.14 keeps its dot
    .trim();
}

/** Exact-ish match for fill-in-the-blank. Returns true on a match, null when unsure (ask Claude). */
export function checkFill(question, typed) {
  const given = normalizeAnswer(typed);
  if (!given) return false;
  const accepted = [question.answer, ...(question.accept_also || [])].map(normalizeAnswer).filter(Boolean);
  return accepted.includes(given) ? true : null;
}

export function isChoiceCorrect(question, chosenIndex) {
  return chosenIndex === question.correct_index;
}

/**
 * Moves the difficulty after each question. `results` is oldest → newest, each
 * { firstTry: boolean, level }. Only the run of answers given at the CURRENT
 * level counts, so the streak resets once the level moves. Three clean ones in
 * a row steps up; two misses in a row steps down.
 */
export function adaptLevel(level, results) {
  const i = LEVELS.indexOf(level);
  const idx = i === -1 ? 1 : i;
  const run = [];
  for (let k = results.length - 1; k >= 0 && results[k].level === level; k--) run.unshift(results[k]);
  const lastThree = run.slice(-3);
  const lastTwo = run.slice(-2);
  if (lastThree.length === 3 && lastThree.every((r) => r.firstTry)) {
    return LEVELS[Math.min(LEVELS.length - 1, idx + 1)];
  }
  if (lastTwo.length === 2 && lastTwo.every((r) => !r.firstTry)) {
    return LEVELS[Math.max(0, idx - 1)];
  }
  return LEVELS[idx];
}

export function sessionSummary(results) {
  const answered = results.length;
  const clean = results.filter((r) => r.firstTry).length;
  const missed = [...new Set(results.filter((r) => !r.firstTry).map((r) => r.topic).filter(Boolean))];
  return { answered, clean, missed, accuracy: answered ? clean / answered : null };
}
