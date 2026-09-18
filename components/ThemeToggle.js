import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle({ compact = false }) {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
    setMounted(true);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem('aio-theme', next ? 'dark' : 'light');
    } catch {}
  }

  if (!mounted) return <div className={compact ? 'h-7 w-7' : 'h-8 w-full'} />;

  if (compact) {
    return (
      <button
        onClick={toggle}
        aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        className="rounded p-1.5 text-faint transition-colors hover:bg-bg hover:text-ink"
      >
        {dark ? <Sun size={15} /> : <Moon size={15} />}
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-2.5 rounded px-3 py-1.5 text-left text-xs text-faint transition-colors hover:bg-bg hover:text-ink"
    >
      {dark ? <Sun size={14} /> : <Moon size={14} />}
      {dark ? 'Light mode' : 'Dark mode'}
    </button>
  );
}
