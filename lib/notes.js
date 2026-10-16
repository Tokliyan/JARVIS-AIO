import { supabase } from '@/lib/supabaseClient';
import { authedFetch } from '@/lib/authedFetch';

// Saved notes (aio_studyboy_docs) and saved study guides (aio_studyboy_outputs
// with mode 'study_guide'), for the Notes and Guides libraries.

export const NOTES_TABLE = 'aio_studyboy_docs';
export const OUTPUTS_TABLE = 'aio_studyboy_outputs';

export const SOURCE_LABEL = {
  device_upload: 'Upload',
  camera_capture: 'Photo',
  google_drive: 'Drive',
  command_bar: 'From school',
  kindle: 'Kindle',
};

/** Same numbering the Kindle uses: doc_number once 004 has run, otherwise upload order. */
export function numberNotes(rows) {
  const oldestFirst = [...(rows || [])].sort(
    (a, b) => new Date(a.uploaded_at || 0) - new Date(b.uploaded_at || 0),
  );
  return (rows || []).map((d) => ({
    ...d,
    n: d.doc_number ?? oldestFirst.findIndex((x) => x.id === d.id) + 1,
  }));
}

export function snippet(text, max = 140) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/** A sensible name for pasted notes: their first line if it reads like a heading. */
export function guessTitle(text, fallbackDate = new Date()) {
  const first = String(text || '')
    .split('\n')
    .map((l) => l.replace(/^[#>*\-\s]+/, '').trim())
    .find(Boolean);
  if (first && first.length <= 70 && !/[.!?]$/.test(first)) return first;
  return `Notes, ${fallbackDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`;
}

/** Notes matching a search: every word must appear in the title, subject or text. */
export function searchNotes(notes, query) {
  const words = String(query || '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return notes;
  return notes.filter((n) => {
    const hay = `${n.file_name || ''} ${n.subject || ''} ${n.ocr_text || ''}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

export async function listNotes() {
  const { data, error } = await supabase
    .from(NOTES_TABLE)
    .select('*')
    .order('uploaded_at', { ascending: false })
    .limit(300);
  if (error) return { ok: false, error: error.message, notes: [] };
  return { ok: true, notes: numberNotes(data) };
}

export async function saveNote({ subject, title, text, source = 'device_upload' }) {
  const { data, error } = await supabase
    .from(NOTES_TABLE)
    .insert({
      subject: subject || 'Unspecified',
      file_name: (title || '').trim() || guessTitle(text),
      source,
      ocr_text: text,
    })
    .select('*')
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, note: data };
}

/** Rename / edit. Without an update policy Supabase changes nothing and says nothing, so check. */
export async function updateNote(id, patch) {
  const { data, error } = await supabase.from(NOTES_TABLE).update(patch).eq('id', id).select('id');
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) {
    return { ok: false, needsSql: true, error: 'Editing notes needs pending-sql/006 run in Supabase first.' };
  }
  return { ok: true };
}

export async function deleteNote(id) {
  const { error } = await supabase.from(NOTES_TABLE).delete().eq('id', id);
  return !error;
}

/** Everything saved for a subject, newest first, as one block of source text. */
export function combineNotes(notes, subject, max = 20000) {
  let text = '';
  for (const n of notes.filter((x) => x.subject === subject)) {
    const piece = `${n.file_name ? `# ${n.file_name}\n` : ''}${n.ocr_text || ''}`.trim();
    if (!piece) continue;
    text += (text ? '\n\n' : '') + piece;
    if (text.length >= max) break;
  }
  return text.slice(0, max);
}

export async function listGuides() {
  const { data, error } = await supabase
    .from(OUTPUTS_TABLE)
    .select('*')
    .eq('mode', 'study_guide')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return { ok: false, error: error.message, guides: [] };
  return { ok: true, guides: data || [] };
}

export async function saveGuide({ subject, payload }) {
  const title = payload.guide?.title
    ? `${payload.guide.title}`
    : `${subject ? subject + ' — ' : ''}Study guide, ${new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`;
  const { data, error } = await supabase
    .from(OUTPUTS_TABLE)
    .insert({ subject: subject || null, mode: 'study_guide', title, payload })
    .select('*')
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, guide: data };
}

export async function deleteGuide(id) {
  const { error } = await supabase.from(OUTPUTS_TABLE).delete().eq('id', id);
  return !error;
}

export async function starGuide(id, starred) {
  const { error } = await supabase.from(OUTPUTS_TABLE).update({ starred }).eq('id', id);
  return !error;
}

// Very long notes get cut here rather than sent whole: past this a single guide
// can't cover them properly anyway, and the page says to split them.
export const MAX_GUIDE_SOURCE = 60000;

/** Ask Claude for a study guide. Returns { ok, payload } or { ok:false, error }. */
export async function generateGuide({ subject, text, depth = 'full', strictness = 'strict', notes = '', sourceDocId }) {
  try {
    const res = await authedFetch('/api/studyboy/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'study_guide',
        subject,
        sourceText: String(text || '').slice(0, MAX_GUIDE_SOURCE),
        depth,
        strictness,
        notes,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error || 'Something went wrong making the guide.' };
    return { ok: true, payload: { ...data, source_doc_id: sourceDocId || null } };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
