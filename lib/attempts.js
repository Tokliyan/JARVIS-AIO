import { supabase } from '@/lib/supabaseClient';

// Every quiz mark and flashcard rating lands here, one row per question/card, so
// Studyboy can tell which topics keep going wrong over time.
//
// The table is created by pending-sql/001_aio_studyboy_attempts.sql. Until that's
// been run by hand in Supabase it simply won't exist — recording is best-effort
// and never blocks or interrupts studying, so failures are swallowed.

export const ATTEMPTS_TABLE = 'aio_studyboy_attempts';

/** rows: [{ subject, topic, mode: 'quiz'|'flashcards', correct }] */
export async function recordAttempts(rows) {
  const clean = (rows || [])
    .filter((r) => r && typeof r.correct === 'boolean')
    .map((r) => ({
      subject: r.subject || null,
      topic: (r.topic || '').trim() || null,
      mode: r.mode,
      correct: r.correct,
    }));
  if (clean.length === 0) return false;

  const { error } = await supabase.from(ATTEMPTS_TABLE).insert(clean);
  return !error;
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
