import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

const TEXT_TYPES = ['text/plain', 'text/markdown', 'text/csv', 'application/json'];

export default function SourceMaterial({ subject, setSubject, sourceText, setSourceText }) {
  const [docs, setDocs] = useState([]);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState(null);
  const [fileName, setFileName] = useState('');
  const [lastSource, setLastSource] = useState('device_upload');
  const fileRef = useRef(null);
  const cameraRef = useRef(null);

  useEffect(() => {
    loadDocs();
  }, []);

  async function loadDocs() {
    const { data } = await supabase
      .from('aio_studyboy_docs')
      .select('*')
      .order('uploaded_at', { ascending: false })
      .limit(20);
    setDocs(data || []);
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = () => reject(new Error('Could not read that file.'));
      reader.readAsDataURL(file);
    });
  }

  async function handleFile(e, source) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setFileName(file.name);
    setLastSource(source);

    // Plain text files need no extraction.
    if (TEXT_TYPES.includes(file.type) || /\.(txt|md|csv|json)$/i.test(file.name)) {
      setSourceText(await file.text());
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('That file is over 10MB — try a smaller one or split it up.');
      return;
    }

    setExtracting(true);
    try {
      const base64 = await fileToBase64(file);
      const res = await fetch('/api/studyboy/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, mediaType: file.type }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || 'Could not read that file.');
      else setSourceText((prev) => (prev ? prev + '\n\n' + data.text : data.text));
    } catch (err) {
      setError(err.message);
    } finally {
      setExtracting(false);
    }
  }

  async function saveDoc() {
    if (!sourceText.trim()) return;
    setSaving(true);
    await supabase.from('aio_studyboy_docs').insert({
      subject: subject || 'Unspecified',
      file_name: fileName || `Pasted ${new Date().toLocaleDateString('en-AU')}`,
      source: lastSource,
      ocr_text: sourceText,
    });
    setSaving(false);
    setFileName('');
    loadDocs();
  }

  function loadDoc(doc) {
    setSourceText(doc.ocr_text || '');
    setSubject(doc.subject || '');
    setFileName(doc.file_name || '');
  }

  async function deleteDoc(id, e) {
    e.stopPropagation();
    await supabase.from('aio_studyboy_docs').delete().eq('id', id);
    loadDocs();
  }

  return (
    <div className="rounded border border-border bg-surface p-4">
      <h2 className="mb-3 text-sm font-medium text-ink">Source material</h2>
      <p className="mb-3 text-xs text-muted">
        Paste notes, upload a PDF or past paper, or photograph handwritten work. Everything
        Studyboy makes is built from this — not generic knowledge.
      </p>

      <div className="mb-3 flex flex-wrap gap-2">
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject (e.g. Maths Ext)"
          className="w-48 rounded border border-border bg-bg px-2 py-1.5 text-sm"
        />

        <input
          ref={fileRef}
          type="file"
          accept=".txt,.md,.csv,.json,.pdf,image/*"
          onChange={(e) => handleFile(e, 'device_upload')}
          className="hidden"
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => handleFile(e, 'camera_capture')}
          className="hidden"
        />

        <button
          onClick={() => fileRef.current?.click()}
          disabled={extracting}
          className="rounded border border-border px-3 py-1.5 text-sm text-ink hover:bg-bg disabled:opacity-50"
        >
          Upload file
        </button>
        <button
          onClick={() => cameraRef.current?.click()}
          disabled={extracting}
          className="rounded border border-border px-3 py-1.5 text-sm text-ink hover:bg-bg disabled:opacity-50"
        >
          Take photo
        </button>
        <button
          onClick={saveDoc}
          disabled={saving || extracting || !sourceText.trim()}
          className="rounded border border-border px-3 py-1.5 text-sm text-ink hover:bg-bg disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save for later'}
        </button>
        {fileName && <span className="self-center font-mono text-xs text-muted">{fileName}</span>}
      </div>

      {extracting && (
        <p className="mb-2 text-xs text-accent">Reading the document…</p>
      )}
      {error && <p className="mb-2 text-xs text-bad">{error}</p>}

      <textarea
        value={sourceText}
        onChange={(e) => setSourceText(e.target.value)}
        rows={10}
        placeholder="Paste your material here…"
        className="w-full rounded border border-border bg-bg px-3 py-2 font-mono text-xs text-ink placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent"
      />
      <div className="mt-1 text-right font-mono text-[10px] text-muted">
        {sourceText.length.toLocaleString()} characters
      </div>

      {docs.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <div className="mb-2 text-xs text-muted">Saved material</div>
          <div className="flex flex-wrap gap-2">
            {docs.map((d) => (
              <button
                key={d.id}
                onClick={() => loadDoc(d)}
                className="group flex items-center gap-2 rounded border border-border px-2 py-1 text-xs text-ink hover:bg-bg"
              >
                <span>
                  {d.subject} · {d.file_name}
                </span>
                <span
                  onClick={(e) => deleteDoc(d.id, e)}
                  className="hidden text-muted hover:text-bad group-hover:inline"
                >
                  ×
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
