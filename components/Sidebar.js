import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabaseClient';
import { Clock, CalendarDays, GraduationCap, FolderKanban, LogOut } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';

const NAV = [
  { href: '/status', label: 'Today', icon: Clock },
  { href: '/', label: 'Timetable', icon: CalendarDays },
  { href: '/studyboy', label: 'Studyboy', icon: GraduationCap },
  { href: '/projects', label: 'Projects', icon: FolderKanban },
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

  const today = new Date().toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  return (
    <>
      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur md:hidden">
        <div className="flex items-center justify-between px-4 pt-3">
          <Link href="/status" className="text-sm font-medium tracking-tight text-ink">
            JARVIS AIO
          </Link>
          <div className="flex items-center gap-0.5">
            <ThemeToggle compact />
            <button
              onClick={signOut}
              aria-label="Sign out"
              className="rounded p-1.5 text-faint transition-colors hover:bg-bg hover:text-ink"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2 pt-2">
          {NAV.map((item) => {
            const active = isActive(router.pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex shrink-0 items-center gap-1.5 rounded px-3 py-1.5 text-sm transition-colors ${
                  active ? 'bg-bg font-medium text-ink' : 'text-muted'
                }`}
              >
                <Icon size={14} strokeWidth={active ? 2.25 : 1.75} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      {/* Desktop sidebar */}
      <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-surface px-3 py-5 md:flex">
        <div className="mb-6 px-3">
          <Link href="/status" className="text-sm font-medium tracking-tight text-ink">
            JARVIS AIO
          </Link>
          <div className="tnum mt-0.5 text-2xs text-faint">{today}</div>
        </div>

        <div className="mb-2 px-3 text-2xs uppercase tracking-wider text-faint">Workspace</div>
        <nav className="flex flex-1 flex-col gap-0.5">
          {NAV.map((item) => {
            const active = isActive(router.pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-2.5 rounded px-3 py-1.5 text-sm transition-colors ${
                  active ? 'bg-bg font-medium text-ink' : 'text-muted hover:bg-bg hover:text-ink'
                }`}
              >
                <Icon size={15} strokeWidth={active ? 2.25 : 1.75} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-0.5 border-t border-border pt-3">
          <ThemeToggle />
          <button
            onClick={signOut}
            className="flex items-center gap-2.5 rounded px-3 py-1.5 text-left text-xs text-faint transition-colors hover:bg-bg hover:text-ink"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
