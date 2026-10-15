import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, Camera, FileText, FileUp, Plus, Search, Sparkles, Trash2 } from 'lucide-react';
import DrivePicker from '@/components/DrivePicker';
import useMaterialUpload, { ACCEPT } from '@/components/useMaterialUpload';
import { SOURCE_LABEL, deleteNote, saveNote, searchNotes, snippet, updateNote } from '@/lib/notes';
import { SUBJECTS } from '@/lib/subjects';

// Every note you've saved, in one place: search them, open one to read it,
// fix it up, and turn it into a study guide or practice from it.

function day(iso) {
  return iso ? new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
}

function Scope({ scope, setScope, subject }) {
  return (
    <div className="flex overflow-hidden rounded border border-border text-xs">
      {[
        ['subject', subject],
        ['all', 'All subjects'],
      ].map(([id, label]) => (
        <button
          key={id}
          onClick={() => setScope(id)}
          aria-pressed={scope === id}
          className={`max-w-[11rem] truncate px-2.5 py-1.5 ${scope === id ? 'bg-accent text-white' : 'text-ink hover:bg-bg'}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function NoteEditor({ subject, onSaved, onCancel, onMakeGuide }) {
  const [title, setTitle] = useState('');
  const [subj, setSubj] = useState(subject);
  const [text, setText] = useState('');
  const [source, setSource] = useState('device_upload');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const { readFile, reading, error, setError } = useMaterialUpload();
  const fileRef = useRef(null);
  const cameraRef = useRef(null);

  async function pick(e, kind) {
    const file = e.target.files?.[0];
    e.target.value = '';
    const got = await readFile(file, kind);
    if (!got) return;
    setText((t) => (t.trim() ? `${t}\n\n${got.text}` : got.text));
    if (!title) setTitle(got.name.replace(/\.[^.]+$/, ''));
    setSource(kind);
  }

  async function save(thenGuide) {
    setSaving(true);
    setSaveError('');
    const res = await saveNote({ subject: subj, title, text, source });
    setSaving(false);
    if (!res.ok) {
      setSaveError(`Couldn't save: ${res.error}`);
      return;
    }
    onSaved(res.note);
    if (thenGuide) onMakeGuide(res.note, 'full');
  }

  const ready = text.trim().length > 0 && !saving && !reading;

  return (
    <div className="rounded border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-ink">New note</h2>
        <button onClick={onCancel} className="text-xs text-muted hover:text-ink">
          Cancel
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <select
          value={subj}
          onChange={(e) => setSubj(e.target.value)}
          className="rounded border border-border bg-bg px-2 py-1.5 text-sm text-ink"
          aria-label="Subject"
        >
          {SUBJECTS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title, e.g. Cell division"
          className="min-w-[12rem] flex-1 rounded border border-border bg-bg px-2 py-1.5 text-sm text-ink placeholder:text-muted"
        />
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={12}
        placeholder="Paste or type your notes…"
        className="mt-2 w-full rounded border border-border bg-bg px-3 py-2 text-sm leading-relaxed text-ink placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent"
      />
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <input ref={fileRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => pick(e, 'device_upload')} />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => pick(e, 'camera_capture')}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={reading}
          className="flex items-center gap-1.5 rounded border border-border px-2.5 py-1.5 text-xs text-ink hover:bg-bg disabled:opacity-50"
        >
          <FileUp size={13} /> Upload
        </button>
        <button
          onClick={() => cameraRef.current?.click()}
          disabled={reading}
          className="flex items-center gap-1.5 rounded border border-border px-2.5 py-1.5 text-xs text-ink hover:bg-bg disabled:opacity-50"
        >
          <Camera size={13} /> Photo
        </button>
        <DrivePicker
          disabled={reading}
          onError={(m) => setError(m)}
          onText={(t, name) => {
            setText((prev) => (prev.trim() ? `${prev}\n\n${t}` : t));
            if (!title && name) setTitle(name.replace(/\.[^.]+$/, ''));
            setSource('google_drive');
          }}
        />
      </div>
      {reading && <p className="mt-2 text-xs text-accent">Reading the file…</p>}
      {(error || saveError) && <p className="mt-2 text-xs text-bad">{error || saveError}</p>}
      <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-border pt-3">
        <button
          onClick={() => save(false)}
          disabled={!ready}
          className="rounded border border-border px-3 py-1.5 text-sm text-ink hover:bg-bg disabled:opacity-50"
        >
          Save note
        </button>
        <button
          onClick={() => save(true)}
          disabled={!ready || text.trim().length < 50}
          className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          Save and make study guide
        </button>
      </div>
    </div>
  );
}

function NoteDetail({ note, guides, making, onBack, onChanged, onDeleted, onMakeGuide, onOpenGuide, onPractise }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(note.file_name || '');
  const [subj, setSubj] = useState(note.subject || SUBJECTS[0]);
  const [text, setText] = useState(note.ocr_text || '');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setEditing(false);
    setTitle(note.file_name || '');
    setSubj(note.subject || SUBJECTS[0]);
    setText(note.ocr_text || '');
    setMsg('');
  }, [note]);

  async function save() {
    setBusy(true);
    const res = await updateNote(note.id, { file_name: title.trim() || note.file_name, subject: subj, ocr_text: text });
    setBusy(false);
    if (!res.ok) {
      setMsg(res.error);
      return;
    }
    setEditing(false);
    setMsg('Saved');
    onChanged();
  }

  async function remove() {
    if (!window.confirm(`Delete "${note.file_name}"? Guides made from it are kept.`)) return;
    if (await deleteNote(note.id)) onDeleted();
    else setMsg("Couldn't delete it.");
  }

  const words = (note.ocr_text || '').split(/\s+/).filter(Boolean).length;
  const made = guides.filter((g) => g.payload?.source_doc_id === note.id);

  return (
    <div className="min-w-0 rounded border border-border bg-surface p-4 sm:p-5">
      <button onClick={onBack} className="mb-3 flex items-center gap-1 text-xs text-muted hover:text-ink md:hidden">
        <ArrowLeft size={13} /> All notes
      </button>

      {editing ? (
        <div className="flex flex-wrap gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="min-w-[12rem] flex-1 rounded border border-border bg-bg px-2 py-1.5 text-base font-medium text-ink"
            aria-label="Title"
          />
          <select
            value={subj}
            onChange={(e) => setSubj(e.target.value)}
            className="rounded border border-border bg-bg px-2 py-1.5 text-sm text-ink"
            aria-label="Subject"
          >
            {SUBJECTS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
      ) : (
        <>
          <h2 className="text-xl font-semibold leading-snug text-ink">{note.file_name || 'Untitled notes'}</h2>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
            <span>{note.subject}</span>
            <span className="font-mono">#{note.n}</span>
            <span>{SOURCE_LABEL[note.source] || 'Saved'}</span>
            <span>{day(note.uploaded_at)}</span>
            <span>{words.toLocaleString()} words</span>
          </div>
        </>
      )}

      {!editing && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            onClick={() => onMakeGuide(note, 'full')}
            disabled={making || words < 10}
            className="flex items-center gap-1.5 rounded bg-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            <Sparkles size={14} /> Make study guide
          </button>
          <button
            onClick={() => onMakeGuide(note, 'concise')}
            disabled={making || words < 10}
            className="rounded border border-border px-3 py-1.5 text-sm text-ink hover:bg-bg disabled:opacity-50"
          >
            Quick revision sheet
          </button>
          <button
            onClick={() => onPractise(note, 'Smart Study')}
            className="rounded border border-border px-3 py-1.5 text-sm text-ink hover:bg-bg"
          >
            Smart Study
          </button>
          <button
            onClick={() => onPractise(note, 'Quizzes & papers')}
            className="rounded border border-border px-3 py-1.5 text-sm text-ink hover:bg-bg"
          >
            Quiz, cards, test
          </button>
          <span className="ml-auto flex gap-3">
            <button onClick={() => setEditing(true)} className="text-xs text-muted hover:text-ink hover:underline">
              Edit
            </button>
            <button onClick={remove} className="flex items-center gap-1 text-xs text-muted hover:text-bad">
              <Trash2 size={12} /> Delete
            </button>
          </span>
        </div>
      )}

      {made.length > 0 && !editing && (
        <div className="mt-4 rounded border border-border bg-bg px-3 py-2">
          <div className="mb-1 text-2xs uppercase text-muted">Guides from these notes</div>
          <ul className="flex flex-col gap-1">
            {made.map((g) => (
              <li key={g.id}>
                <button
                  onClick={() => onOpenGuide(g)}
                  className="flex items-center gap-1.5 text-left text-sm text-accent hover:underline"
                >
                  <BookOpen size={13} /> {g.title}
                  <span className="text-2xs text-muted">· {day(g.created_at)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {msg && <p className={`mt-3 text-xs ${msg === 'Saved' ? 'text-good' : 'text-bad'}`}>{msg}</p>}

      <div className="mt-4 border-t border-border pt-4">
        {editing ? (
          <>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={18}
              className="w-full rounded border border-border bg-bg px-3 py-2 text-sm leading-relaxed text-ink focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <div className="mt-2 flex justify-end gap-2">
              <button onClick={() => setEditing(false)} className="rounded px-3 py-1.5 text-sm text-muted hover:text-ink">
                Cancel
              </button>
              <button
                onClick={save}
                disabled={busy}
                className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {busy ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </>
        ) : (
          <div className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-ink">
            {note.ocr_text || <span className="text-muted">This note is empty.</span>}
          </div>
        )}
      </div>
    </div>
  );
}

export default function NotesLibrary({
  notes,
  loading,
  error,
  guides,
  subject,
  selectedId,
  onSelect,
  onRefresh,
  making,
  onMakeGuide,
  onOpenGuide,
  onPractise,
}) {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState('subject');
  const [creating, setCreating] = useState(false);

  const inScope = scope === 'all' || query.trim() ? notes : notes.filter((n) => n.subject === subject);
  const shown = searchNotes(inScope, query);
  const selected = notes.find((n) => n.id === selectedId) || null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="relative min-w-[12rem] flex-1">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search all your notes"
            className="w-full rounded border border-border bg-surface py-1.5 pl-8 pr-2 text-sm text-ink placeholder:text-muted"
            aria-label="Search notes"
          />
        </label>
        <Scope scope={scope} setScope={setScope} subject={subject} />
        <button
          onClick={() => {
            setCreating(true);
            onSelect(null);
          }}
          className="flex items-center gap-1 rounded bg-accent px-3 py-1.5 text-sm font-medium text-white"
        >
          <Plus size={14} /> New note
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-[18rem_1fr]">
        <div className={`${selected || creating ? 'max-md:hidden' : ''}`}>
          {loading ? (
            <p className="text-sm text-muted">Loading your notes…</p>
          ) : error ? (
            <p className="text-sm text-bad">Couldn&apos;t load notes: {error}</p>
          ) : shown.length === 0 ? (
            <div className="rounded border border-dashed border-border px-3 py-4 text-sm text-muted">
              {query.trim()
                ? `Nothing matches "${query.trim()}".`
                : scope === 'subject'
                  ? `No ${subject} notes yet. Press New note, or paste some into Make a study guide on Home.`
                  : 'No notes yet.'}
            </div>
          ) : (
            <>
              <div className="mb-1.5 text-2xs text-muted">
                {shown.length} note{shown.length === 1 ? '' : 's'}
                {query.trim() ? ' found' : scope === 'subject' ? ` in ${subject}` : ''}
              </div>
              <ul className="flex max-h-[70vh] flex-col overflow-y-auto rounded border border-border bg-surface md:sticky md:top-4">
                {shown.map((n) => {
                  const active = n.id === selectedId;
                  return (
                    <li key={n.id} className="border-b border-border last:border-b-0">
                      <button
                        onClick={() => {
                          setCreating(false);
                          onSelect(n.id);
                        }}
                        className={`flex w-full flex-col gap-0.5 px-3 py-2.5 text-left transition-colors ${
                          active ? 'bg-accent/10' : 'hover:bg-bg'
                        }`}
                      >
                        <span className="flex items-center gap-1.5 text-sm text-ink">
                          <FileText size={13} className="shrink-0 text-faint" />
                          <span className="truncate font-medium">{n.file_name || 'Untitled notes'}</span>
                        </span>
                        <span className="truncate text-2xs text-muted">
                          {[scope === 'all' || query.trim() ? n.subject : null, SOURCE_LABEL[n.source], day(n.uploaded_at)]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                        <span className="line-clamp-2 text-xs text-faint">{snippet(n.ocr_text, 160)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>

        <div className="min-w-0">
          {creating ? (
            <NoteEditor
              subject={subject}
              onCancel={() => setCreating(false)}
              onSaved={(note) => {
                setCreating(false);
                onRefresh().then(() => onSelect(note.id));
              }}
              onMakeGuide={onMakeGuide}
            />
          ) : selected ? (
            <NoteDetail
              note={selected}
              guides={guides}
              making={making}
              onBack={() => onSelect(null)}
              onChanged={onRefresh}
              onDeleted={() => {
                onSelect(null);
                onRefresh();
              }}
              onMakeGuide={onMakeGuide}
              onOpenGuide={onOpenGuide}
              onPractise={onPractise}
            />
          ) : (
            <div className="hidden h-full min-h-[12rem] items-center justify-center rounded border border-dashed border-border text-sm text-muted md:flex">
              Pick a note to read it, or make a guide from it.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
