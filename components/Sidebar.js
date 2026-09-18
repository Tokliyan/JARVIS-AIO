import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabaseClient';

const NAV = [
  { href: '/status', label: 'Today' },
  { href: '/', label: 'Timetable' },
  { href: '/studyboy', label: 'Studyboy' },
  { href: '/projects', label: 'Projects' },
];

function isActive(pathname, href) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(href + '/');
}

export default function Sidebar() {
  const router = useRouter();

  async function signOut() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  return (
    <>
      {/* Mobile: a top bar with horizontally scrollable nav. */}
      <header className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur md:hidden">
        <div className="flex items-center justify-between px-4 pt-3">
          <Link href="/status" className="text-sm font-medium tracking-tight text-ink">
            Ambient Intelligence
          </Link>
          <button onClick={signOut} className="text-xs text-faint">
            Sign out
          </button>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2 pt-2">
          {NAV.map((item) => {
            const active = isActive(router.pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`shrink-0 rounded px-3 py-1.5 text-sm transition-colors ${
                  active ? 'bg-bg font-medium text-ink' : 'text-muted'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      {/* Desktop: the sidebar. */}
      <aside className="hidden w-52 shrink-0 flex-col border-r border-border bg-surface px-3 py-5 md:flex">
        <Link href="/status" className="mb-8 px-3 text-sm font-medium tracking-tight text-ink">
          Ambient Intelligence
        </Link>

        <nav className="flex flex-1 flex-col gap-0.5">
          {NAV.map((item) => {
            const active = isActive(router.pathname, item.href);
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
    </>
  );
}
