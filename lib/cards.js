import { supabase } from '@/lib/supabaseClient';
import { nextReview } from '@/lib/srs';

// The review deck lives in aio_studyboy_cards, created by pending-sql/006.
// Until that has been run by hand in Supabase every call here reports
// "unavailable" instead of throwing, and the UI says what to do.

export const CARDS_TABLE = 'aio_studyboy_cards';

function tableMissing(error) {
  return !!error && /aio_studyboy_cards|schema cache|does not exist/i.test(error.message || '');
}

/**
 * cards: [{ topic, front, back }]. Cards whose question is already in the deck
 * for that subject are left alone, so adding the same flashcards twice is safe.
 */
export async function addCards(subject, cards, source = 'flashcards') {
  const rows = (cards || [])
    .filter((c) => c?.front && c?.back)
    .map((c) => ({
      subject: subject || 'Unspecified',
      topic: (c.topic || '').trim() || null,
      front: String(c.front).trim(),
      back: String(c.back).trim(),
      source,
    }));
  if (rows.length === 0) return { ok: true, added: 0 };

  const { data, error } = await supabase
    .from(CARDS_TABLE)
    .upsert(rows, { onConflict: 'user_id,subject,front', ignoreDuplicates: true })
    .select('id');
  if (error) return { ok: false, unavailable: tableMissing(error), error: error.message };
  return { ok: true, added: (data || []).length };
}

/** Every card for the deck summary (just the scheduling columns), optionally one subject. */
export async function loadDeck(subject) {
  let q = supabase
    .from(CARDS_TABLE)
    .select('id, subject, topic, front, back, ease, interval_days, reps, lapses, due_at, last_reviewed_at')
    .order('due_at', { ascending: true })
    .limit(2000);
  if (subject) q = q.eq('subject', subject);
  const { data, error } = await q;
  if (error) return { ok: false, unavailable: tableMissing(error), error: error.message };
  return { ok: true, cards: data || [] };
}

export async function reviewCard(card, rating, now = new Date()) {
  const patch = nextReview(card, rating, now);
  const { error } = await supabase.from(CARDS_TABLE).update(patch).eq('id', card.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, card: { ...card, ...patch } };
}

export async function deleteCard(id) {
  const { error } = await supabase.from(CARDS_TABLE).delete().eq('id', id);
  return !error;
}
