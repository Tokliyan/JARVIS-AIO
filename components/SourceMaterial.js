import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function SourceMaterial({ subject, setSubject, sourceText, setSourceText }) {
  const [docs, setDocs] = useState([]);
  const [saving, setSaving] = useState(false);
  const [fileName, setFileName] = useState('');
  const fileRef = useRef(null);

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

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    setSourceText(text);
  }

  async function saveDoc() {
    if (!sourceText.trim()) return;
    setSaving(true);
    await supabase.from('aio_studyboy_docs').insert({
      subject: subject || 'Unspecified',
      file_name: fileName || `Pasted ${new Date().toLocaleDateString('en-AU')}`,
      source: fileName ? 'device_upload' : 'camera_capture',
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

  return (
    <div className="rounded border border-border bg-surface p-4">
      <h2 className="mb-3 text-sm font-medium text-ink">Source material</h2>
      <p className="mb-3 text-xs text-muted">
        Paste your notes, syllabus, or a past paper from class. Everything Studyboy generates is
        built from this, not from generic knowledge.
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
          accept=".txt,.md,.csv,.json"
          onChange={handleFile}
          className="hidden"
        />
        <button
          onClick={() => fileRef.current?.click()}
          className="rounded border border-border px-3 py-1.5 text-sm text-ink hover:bg-bg"
        >
          Upload file
        </button>
        <button
          onClick={saveDoc}
          disabled={saving || !sourceText.trim()}
          className="rounded border border-border px-3 py-1.5 text-sm text-ink hover:bg-bg disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save for later'}
        </button>
        {fileName && <span className="self-center font-mono text-xs text-muted">{fileName}</span>}
      </div>

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
                className="rounded border border-border px-2 py-1 text-xs text-ink hover:bg-bg"
              >
                {d.subject} · {d.file_name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
