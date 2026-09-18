import { useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { supabase } from '@/lib/supabaseClient';

const MODE_LABEL = {
  past_paper: 'Paper',
  study_guide: 'Guide',
  flashcards: 'Cards',
  quiz: 'Quiz',
  study_plan: 'Plan',
};

const MODE_TONE = {
  past_paper: 'bg-[#E8F0FE] text-[#2B5CA8]',
  study_guide: 'bg-[#E9F3EC] text-[#2F6F4E]',
  flashcards: 'bg-[#F3ECFB] text-[#6B44A8]',
  quiz: 'bg-[#FDF0E4] text-[#B4761F]',
  study_plan: 'bg-[#EEF6E4] text-[#4F7A20]',
};

function History({ onOpen }, ref) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    load();
  }, []);

  useImperativeHandle(ref, () => ({ reload: load }));

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('aio_studyboy_outputs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    setItems(data || []);
    setLoading(false);
  }

  async function toggleStar(item, e) {
    e.stopPropagation();
    await supabase
      .from('aio_studyboy_outputs')
      .update({ starred: !item.starred })
      .eq('id', item.id);
    load();
  }

  async function remove(id, e) {
    e.stopPropagation();
    await supabase.from('aio_studyboy_outputs').delete().eq('id', id);
    load();
  }

  const shown =
    filter === 'all'
      ? items
      : filter === 'starred'
        ? items.filter((i) => i.starred)
        : items.filter((i) => i.mode === filter);

  if (loading) return <p className="text-sm text-muted">Loading…</p>;

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted">
        Nothing saved yet. Everything you generate gets kept here so you can reopen it later.
      </p>
    );
  }

  const modes = [...new Set(items.map((i) => i.mode))];
  const starredCount = items.filter((i) => i.starred).length;

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1">
        <Chip active={filter === 'all'} onClick={() => setFilter('all')}>
          All ({items.length})
        </Chip>
        {starredCount > 0 && (
          <Chip active={filter === 'starred'} onClick={() => setFilter('starred')}>
            Starred ({starredCount})
          </Chip>
        )}
        {modes.map((m) => (
          <Chip key={m} active={filter === m} onClick={() => setFilter(m)}>
            {MODE_LABEL[m]} ({items.filter((i) => i.mode === m).length})
          </Chip>
        ))}
      </div>

      <ul className="flex flex-col divide-y divide-border rounded border border-border bg-surface">
        {shown.map((item, i) => (
          <li
            key={item.id}
            onClick={() => onOpen(item)}
            className="group flex animate-row-in cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-bg"
            style={{ animationDelay: `${Math.min(i * 25, 250)}ms` }}
          >
            <span
              className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${MODE_TONE[item.mode]}`}
            >
              {MODE_LABEL[item.mode]}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm text-ink">{item.title}</div>
              <div className="text-xs text-faint">
                {item.subject || 'No subject'} &nbsp;
                <span className="tnum">
                  {new Date(item.created_at).toLocaleDateString('en-AU', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
              </div>
            </div>
            <button
              onClick={(e) => toggleStar(item, e)}
              aria-label={item.starred ? 'Unstar' : 'Star'}
              className={`shrink-0 text-sm transition-colors ${
                item.starred ? 'text-warn' : 'text-border hover:text-warn'
              }`}
            >
              ★
            </button>
            <button
              onClick={(e) => remove(item.id, e)}
              className="shrink-0 text-xs text-faint opacity-0 transition-opacity hover:text-bad group-hover:opacity-100"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`rounded px-2.5 py-1 text-xs transition-colors ${
        active ? 'bg-bg font-medium text-ink' : 'text-muted hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}

export default forwardRef(History);
