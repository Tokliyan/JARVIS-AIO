import { supabase } from '@/lib/supabaseClient';

// Every quiz mark and flashcard rating lands here, one row per question/card, so
// Studyboy can tell which topics keep going wrong over time.
//
// The table is created by pending-sql/001_aio_studyboy_attempts.sql. Until that's
// been run by hand in Supabase it simply won't exist — recording is best-effort
// and never blocks or interrupts studying, so failures are swallowed.

export const ATTEMPTS_TABLE = 'aio_studyboy_attempts';

// 'smart_study' and 'practice_test' (and the question/answer text columns) need
// pending-sql/006. Before it has run, the richer insert is refused, so we fall
// back to the original columns and file those under 'quiz' — topic accuracy
// keeps working, only the per-question history is missing.
const BASE_MODES = ['quiz', 'flashcards'];

/**
 * rows: [{ subject, topic, mode: 'quiz'|'flashcards'|'smart_study'|'practice_test',
 *          correct, question?, user_answer?, kind?, hint_used? }]
 */
export async function recordAttempts(rows) {
  const clean = (rows || [])
    .filter((r) => r && typeof r.correct === 'boolean')
    .map((r) => ({
      subject: r.subject || null,
      topic: (r.topic || '').trim() || null,
      mode: r.mode,
      correct: r.correct,
      question: r.question ? String(r.question).slice(0, 1000) : null,
      user_answer: r.user_answer ? String(r.user_answer).slice(0, 1000) : null,
      kind: r.kind || null,
      hint_used: !!r.hint_used,
    }));
  if (clean.length === 0) return false;

  const { error } = await supabase.from(ATTEMPTS_TABLE).insert(clean);
  if (!error) return true;

  const basic = clean.map(({ subject, topic, mode, correct }) => ({
    subject,
    topic,
    mode: BASE_MODES.includes(mode) ? mode : 'quiz',
    correct,
  }));
  const retry = await supabase.from(ATTEMPTS_TABLE).insert(basic);
  return !retry.error;
}

/**
 * Raw attempts for one subject, newest first — for the Progress tab. Returns
 * null when the table isn't there yet. Question text is only present once
 * pending-sql/006 has run.
 */
export async function loadAttempts(subject, { limit = 500 } = {}) {
  const full = await supabase
    .from(ATTEMPTS_TABLE)
    .select('id, topic, correct, mode, created_at, question, user_answer, kind, hint_used')
    .eq('subject', subject)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (!full.error) return { rows: full.data || [], hasQuestions: true };

  const basic = await supabase
    .from(ATTEMPTS_TABLE)
    .select('id, topic, correct, mode, created_at')
    .eq('subject', subject)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (basic.error) return null;
  return { rows: basic.data || [], hasQuestions: false };
}

/**
 * Recent attempts for a subject, folded into per-topic accuracy. Returns null
 * when the table isn't there yet, so callers can hide the UI entirely rather
 * than showing an empty state that will never fill.
 */
export async function loadTopicAccuracy(subject, { limit = 300 } = {}) {
  const { data, error } = await supabase
    .from(ATTEMPTS_TABLE)
    .select('topic, correct, mode, created_at')
    .eq('subject', subject)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return null;

  const byTopic = new Map();
  for (const row of data || []) {
    const topic = row.topic || 'Unlabelled';
    const t = byTopic.get(topic) || { topic, attempts: 0, correct: 0, lastSeen: row.created_at };
    t.attempts += 1;
    if (row.correct) t.correct += 1;
    byTopic.set(topic, t);
  }

  return [...byTopic.values()].map((t) => ({ ...t, accuracy: t.correct / t.attempts }));
}
