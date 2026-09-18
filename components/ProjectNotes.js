import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function ProjectNotes({ project, onChange }) {
  const [notes, setNotes] = useState(Array.isArray(project.notes) ? project.notes : []);
  const [editing, setEditing] = useState(null); // index being edited, or 'new'
  const [heading, setHeading] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  async function persist(next) {
    setNotes(next);
    setSaving(true);
    await supabase
      .from('aio_projects')
      .update({ notes: next, updated_at: new Date().toISOString() })
      .eq('id', project.id);
    setSaving(false);
    onChange?.();
  }

  function startNew() {
    setEditing('new');
    setHeading('');
    setBody('');
  }

  function startEdit(i) {
    setEditing(i);
    setHeading(notes[i].heading);
    setBody(notes[i].body);
  }

  function save(e) {
    e.preventDefault();
    if (!heading.trim()) return;
    const entry = { heading: heading.trim(), body: body.trim() };
    if (editing === 'new') {
      persist([...notes, entry]);
    } else {
      persist(notes.map((n, i) => (i === editing ? entry : n)));
    }
    setEditing(null);
  }

  function remove(i) {
    persist(notes.filter((_, idx) => idx !== i));
    if (editing === i) setEditing(null);
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-ink">Concepts &amp; notes</h2>
        {editing === null && (
          <button onClick={startNew} className="text-xs text-accent">
            + Add section
          </button>
        )}
      </div>

      {notes.length === 0 && editing === null && (
        <p className="text-sm text-muted">
          Nothing here yet — add a section for concepts, goals, story arcs, whatever&rsquo;s
          worth remembering about this project.
        </p>
      )}

      <div className="flex flex-col gap-4">
        {notes.map((n, i) =>
          editing === i ? (
            <NoteForm
              key={i}
              heading={heading}
              body={body}
              setHeading={setHeading}
              setBody={setBody}
              onSubmit={save}
              onCancel={() => setEditing(null)}
              saving={saving}
            />
          ) : (
            <div key={i} className="group">
              <div className="mb-1 flex items-center gap-2">
                <h3 className="text-xs font-medium uppercase tracking-wider text-faint">
                  {n.heading}
                </h3>
                <button
                  onClick={() => startEdit(i)}
                  className="text-2xs text-faint opacity-0 hover:text-ink group-hover:opacity-100"
                >
                  Edit
                </button>
                <button
                  onClick={() => remove(i)}
                  className="text-2xs text-faint opacity-0 hover:text-bad group-hover:opacity-100"
                >
                  Delete
                </button>
              </div>
              <p className="max-w-prose whitespace-pre-line text-sm leading-relaxed text-ink">
                {n.body}
              </p>
            </div>
          ),
        )}

        {editing === 'new' && (
          <NoteForm
            heading={heading}
            body={body}
            setHeading={setHeading}
            setBody={setBody}
            onSubmit={save}
            onCancel={() => setEditing(null)}
            saving={saving}
            isNew
          />
        )}
      </div>
    </div>
  );
}

function NoteForm({ heading, body, setHeading, setBody, onSubmit, onCancel, saving, isNew }) {
  return (
    <form onSubmit={onSubmit} className="rounded border border-border bg-surface p-3">
      <input
        value={heading}
        onChange={(e) => setHeading(e.target.value)}
        placeholder="Section name — Concepts, Goals, Story arcs…"
        className="mb-2 w-full rounded border border-border bg-bg px-2 py-1.5 text-sm font-medium"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        placeholder="Write it out…"
        className="w-full rounded border border-border bg-bg px-2 py-1.5 text-sm leading-relaxed"
      />
      <div className="mt-2 flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          {isNew ? 'Add section' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-border px-3 py-1.5 text-xs text-ink hover:bg-bg"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
