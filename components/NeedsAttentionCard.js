import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';

export default function NeedsAttentionCard() {
  const [flagged, setFlagged] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('aio_projects')
        .select('name, status_label, status_color')
        .in('status_color', ['warn', 'bad']);
      setFlagged(data || []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <p className="text-sm text-muted">Loading…</p>;

  if (flagged.length === 0) {
    return <p className="text-sm text-muted">All projects running clean.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {flagged.map((p) => (
        <li key={p.name}>
          <Link href="/projects" className="group flex items-start gap-2">
            <span
              className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                p.status_color === 'bad' ? 'bg-bad' : 'bg-warn'
              }`}
            />
            <span className="text-xs">
              <span className="text-ink group-hover:underline">{p.name}</span>
              <span className="block text-faint">{p.status_label}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
