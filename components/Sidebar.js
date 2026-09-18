import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabaseClient';

const NAV = [
  { href: '/status', label: 'Today' },
  { href: '/', label: 'Timetable' },
  { href: '/studyboy', label: 'Studyboy' },
  { href: '/projects', label: 'Projects' },
];

export default function Sidebar() {
  const router = useRouter();

  async function signOut() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  return (
    <aside className="flex w-52 shrink-0 flex-col border-r border-border bg-surface px-3 py-5">
      <Link href="/status" className="mb-8 px-3 text-sm font-medium tracking-tight text-ink">
        Ambient Intelligence
      </Link>

      <nav className="flex flex-1 flex-col gap-0.5">
        {NAV.map((item) => {
          const active = router.pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`rounded px-3 py-1.5 text-sm transition-colors ${
                active ? 'bg-bg font-medium text-ink' : 'text-muted hover:bg-bg hover:text-ink'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <button
        onClick={signOut}
        className="rounded px-3 py-1.5 text-left text-xs text-faint transition-colors hover:bg-bg hover:text-ink"
      >
        Sign out
      </button>
    </aside>
  );
}
