import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { ExternalLink, Plus, X } from 'lucide-react';

export default function StudyResources({ subject }) {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('aio_study_resources')
      .select('*')
      .eq('subject', subject)
      .order('created_at', { ascending: true });
    setResources(data || []);
    setLoading(false);
  }

  async function add(e) {
    e.preventDefault();
    if (!label.trim() || !url.trim()) return;
    await supabase.from('aio_study_resources').insert({ subject, label: label.trim(), url: url.trim() });
    setLabel('');
    setUrl('');
    setAdding(false);
    load();
  }

  async function remove(id) {
    await supabase.from('aio_study_resources').delete().eq('id', id);
    load();
  }

  if (loading) return null;

  return (
    <div className="rounded border border-border bg-surface p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-medium text-ink">Resources — {subject}</h2>
        <button
          onClick={() => setAdding((s) => !s)}
          className="flex items-center gap-1 text-xs text-accent"
        >
          <Plus size={12} />
          Add
        </button>
      </div>

      {resources.length === 0 && !adding && (
        <p className="text-sm text-muted">No resource links for {subject} yet.</p>
      )}

      {resources.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {resources.map((r) => (
            <li key={r.id} className="group flex items-center gap-2">
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-1 items-center gap-1.5 text-sm text-ink hover:text-accent hover:underline"
              >
                <ExternalLink size={13} className="shrink-0 text-faint" />
                <span className="truncate">{r.label}</span>
              </a>
              <button
                onClick={() => remove(r.id)}
                aria-label={`Remove ${r.label}`}
                className="shrink-0 text-faint opacity-0 transition-opacity hover:text-bad group-hover:opacity-100"
              >
                <X size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <form onSubmit={add} className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label"
            className="min-w-[8rem] flex-1 rounded border border-border bg-bg px-2 py-1.5 text-sm"
          />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            className="min-w-[10rem] flex-[2] rounded border border-border bg-bg px-2 py-1.5 text-sm"
          />
          <button
            type="submit"
            className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-white"
          >
            Save
          </button>
        </form>
      )}
    </div>
  );
}
