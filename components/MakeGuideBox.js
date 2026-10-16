import { useRef, useState } from 'react';
import { Camera, FileUp, Sparkles } from 'lucide-react';
import DrivePicker from '@/components/DrivePicker';
import useMaterialUpload, { ACCEPT } from '@/components/useMaterialUpload';
import { MAX_GUIDE_SOURCE } from '@/lib/notes';
import { SUBJECTS } from '@/lib/subjects';

// "Paste your notes, get a study guide." The notes are saved to your Notes
// library at the same time, so they're there to find again later.

export default function MakeGuideBox({ subject, onMake, busy, compact = false }) {
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [chosen, setChosen] = useState(subject);
  const [source, setSource] = useState('device_upload');
  const [depth, setDepth] = useState('full');
  const [strict, setStrict] = useState(true);
  const { readFile, reading, error, setError } = useMaterialUpload();
  const fileRef = useRef(null);
  const cameraRef = useRef(null);

  // Follow the subject chips until the student picks one here.
  const [touched, setTouched] = useState(false);
  const subj = touched ? chosen : subject;

  async function pick(e, kind) {
    const file = e.target.files?.[0];
    e.target.value = '';
    const got = await readFile(file, kind);
    if (!got) return;
    setText((t) => (t.trim() ? `${t}\n\n${got.text}` : got.text));
    if (!title) setTitle(got.name.replace(/\.[^.]+$/, ''));
    setSource(kind);
  }

  async function make() {
    const ok = await onMake({ subject: subj, title, text, source, depth, strictness: strict ? 'strict' : 'extend' });
    if (ok) {
      setText('');
      setTitle('');
    }
  }

  const tooShort = text.trim().length < 50;
  const tooLong = text.length > MAX_GUIDE_SOURCE;

  return (
    <section className="rounded border border-border bg-surface p-4 sm:p-5">
      <h2 className="flex items-center gap-2 text-base font-medium text-ink">
        <Sparkles size={16} className="text-accent" /> Make a study guide
      </h2>
      {!compact && (
        <p className="mt-0.5 text-sm text-muted">
          Paste your notes or upload them. You get a guide organised by topic with key terms, worked examples, common
          mistakes and questions to test yourself. Your notes are saved too.
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <select
          value={subj}
          onChange={(e) => {
            setChosen(e.target.value);
            setTouched(true);
          }}
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
          placeholder="Name these notes (optional)"
          className="min-w-[12rem] flex-1 rounded border border-border bg-bg px-2 py-1.5 text-sm text-ink placeholder:text-muted"
        />
      </div>

      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (error) setError(null);
        }}
        rows={compact ? 6 : 9}
        placeholder="Paste your notes here…"
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
          disabled={reading || busy}
          className="flex items-center gap-1.5 rounded border border-border px-2.5 py-1.5 text-xs text-ink hover:bg-bg disabled:opacity-50"
        >
          <FileUp size={13} /> Upload PDF, Word, PowerPoint
        </button>
        <button
          onClick={() => cameraRef.current?.click()}
          disabled={reading || busy}
          className="flex items-center gap-1.5 rounded border border-border px-2.5 py-1.5 text-xs text-ink hover:bg-bg disabled:opacity-50"
        >
          <Camera size={13} /> Photo
        </button>
        <DrivePicker
          disabled={reading || busy}
          onError={(msg) => setError(msg)}
          onText={(t, name) => {
            setText((prev) => (prev.trim() ? `${prev}\n\n${t}` : t));
            if (!title && name) setTitle(name.replace(/\.[^.]+$/, ''));
            setSource('google_drive');
          }}
        />
        <span className="ml-auto font-mono text-2xs text-faint">{text.length.toLocaleString()} chars</span>
      </div>

      {reading && <p className="mt-2 text-xs text-accent">Reading the file…</p>}
      {error && <p className="mt-2 text-xs text-bad">{error}</p>}
      {tooLong && (
        <p className="mt-2 text-xs text-warn">
          That&apos;s a lot of notes. Only the first {MAX_GUIDE_SOURCE.toLocaleString()} characters go into one guide,
          so split them by topic for the best result.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border pt-3">
        <div className="flex overflow-hidden rounded border border-border text-xs" role="group" aria-label="Guide length">
          {[
            ['concise', 'Quick revision'],
            ['full', 'Full guide'],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setDepth(id)}
              className={`px-2.5 py-1.5 ${depth === id ? 'bg-accent text-white' : 'text-ink hover:bg-bg'}`}
              aria-pressed={depth === id}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-xs text-muted">
          <input type="checkbox" checked={strict} onChange={(e) => setStrict(e.target.checked)} className="h-3.5 w-3.5" />
          Only what&apos;s in my notes
        </label>
        <button
          onClick={make}
          disabled={tooShort || reading || busy}
          className="ml-auto rounded bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-50"
        >
          {busy ? 'Making your guide…' : 'Make study guide'}
        </button>
      </div>
      {tooShort && text.length > 0 && <p className="mt-1.5 text-right text-2xs text-muted">Add a bit more first.</p>}
    </section>
  );
}
