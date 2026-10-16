import { useState } from 'react';
import { ArrowLeft, BookOpen, Plus, Search, Star, Trash2 } from 'lucide-react';
import StudyGuide from '@/components/StudyGuide';
import { deleteGuide, starGuide } from '@/lib/notes';

// All your study guides, newest first. Open one to read it in the guide reader.

function day(iso) {
  return iso ? new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : '';
}

function studiedCount(id) {
  try {
    return JSON.parse(window.localStorage.getItem(`studyboy:guide-studied:${id}`) || '[]').length;
  } catch {
    return 0;
  }
}

export default function GuidesLibrary({
  guides,
  loading,
  subject,
  open,
  onOpen,
  onClose,
  onRefresh,
  onNew,
  onSmartStudy,
  onAttemptsRecorded,
}) {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState('subject');

  if (open) {
    return (
      <div>
        <button onClick={onClose} className="mb-4 flex items-center gap-1 text-xs text-muted hover:text-ink print:hidden">
          <ArrowLeft size={13} /> All study guides
        </button>
        <StudyGuide
          output={open.payload}
          subject={open.subject}
          title={open.title}
          guideId={open.id || undefined}
          onSmartStudy={() => onSmartStudy(open)}
          onAttemptsRecorded={onAttemptsRecorded}
        />
      </div>
    );
  }

  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = guides
    .filter((g) => scope === 'all' || words.length > 0 || g.subject === subject)
    .filter((g) => {
      if (!words.length) return true;
      const topics = (g.payload?.guide?.topics || []).map((t) => t.title).join(' ');
      const hay = `${g.title} ${g.subject || ''} ${topics}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    })
    .sort((a, b) => Number(!!b.starred) - Number(!!a.starred));

  async function star(g, e) {
    e.stopPropagation();
    if (await starGuide(g.id, !g.starred)) onRefresh();
  }

  async function remove(g, e) {
    e.stopPropagation();
    if (!window.confirm(`Delete "${g.title}"?`)) return;
    if (await deleteGuide(g.id)) onRefresh();
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="relative min-w-[12rem] flex-1">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search guides and topics"
            className="w-full rounded border border-border bg-surface py-1.5 pl-8 pr-2 text-sm text-ink placeholder:text-muted"
            aria-label="Search guides"
          />
        </label>
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
        <button onClick={onNew} className="flex items-center gap-1 rounded bg-accent px-3 py-1.5 text-sm font-medium text-white">
          <Plus size={14} /> New guide
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading your guides…</p>
      ) : shown.length === 0 ? (
        <div className="rounded border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
          {words.length
            ? `No guides match "${query.trim()}".`
            : `No ${scope === 'subject' ? subject + ' ' : ''}study guides yet. Paste your notes on Home, or open a note and press Make study guide.`}
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {shown.map((g) => {
            const topics = g.payload?.guide?.topics || [];
            const done = topics.length ? studiedCount(g.id) : 0;
            return (
              <li key={g.id}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpen(g)}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpen(g))}
                  className="group flex h-full cursor-pointer flex-col rounded border border-border bg-surface p-4 transition-colors hover:border-accent/50"
                >
                  <div className="flex items-start gap-2">
                    <BookOpen size={16} className="mt-0.5 shrink-0 text-accent" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium leading-snug text-ink">{g.title}</div>
                      <div className="mt-0.5 text-2xs text-muted">
                        {[g.subject, day(g.created_at), topics.length ? `${topics.length} topics` : 'text guide']
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    </div>
                    <button
                      onClick={(e) => star(g, e)}
                      aria-label={g.starred ? 'Unstar' : 'Star'}
                      className={`shrink-0 ${g.starred ? 'text-warn' : 'text-faint opacity-0 group-hover:opacity-100'} hover:text-warn`}
                    >
                      <Star size={14} fill={g.starred ? 'currentColor' : 'none'} />
                    </button>
                    <button
                      onClick={(e) => remove(g, e)}
                      aria-label="Delete guide"
                      className="shrink-0 text-faint opacity-0 hover:text-bad group-hover:opacity-100"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {g.payload?.guide?.overview && (
                    <p className="mt-2 line-clamp-2 text-sm text-muted">{g.payload.guide.overview}</p>
                  )}
                  {topics.length > 0 && (
                    <div className="mt-auto flex items-center gap-2 pt-3">
                      <div className="h-1 flex-1 overflow-hidden rounded-full bg-bg">
                        <div
                          className="h-full rounded-full bg-accent"
                          style={{ width: `${Math.round((done / topics.length) * 100)}%` }}
                        />
                      </div>
                      <span className="text-2xs text-muted">
                        {done}/{topics.length} studied
                      </span>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
