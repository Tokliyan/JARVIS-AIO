import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabaseClient';

const NAV = [
  { href: '/', label: 'Timetable & Checklist' },
  { href: '/status', label: 'Daily Status' },
  { href: '/projects', label: 'Projects' },
  { href: '/studyboy', label: 'Studyboy' },
];

export default function Sidebar() {
  const router = useRouter();

  async function signOut() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-surface px-4 py-5">
      <div className="mb-6 px-2 font-mono text-sm text-ink">
        Ambient Intelligence
      </div>
      <nav className="flex flex-1 flex-col gap-0.5">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded px-3 py-2 text-sm text-ink hover:bg-bg"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <button
        onClick={signOut}
        className="rounded px-3 py-2 text-left text-sm text-muted hover:bg-bg"
      >
        Sign out
      </button>
    </aside>
  );
}
