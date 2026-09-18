import { useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabaseClient';

// One fixed account behind the scenes — you only ever see the password box.
// The email itself isn't a secret, it's just Supabase's required ID field.
const ACCOUNT_EMAIL = 'harsh@ambient-intelligence.local';

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email: ACCOUNT_EMAIL,
      password,
    });

    setLoading(false);
    if (error) {
      setError('Wrong password.');
    } else {
      router.replace('/');
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-xs">
        <p className="mb-6 text-sm font-medium tracking-tight text-ink">JARVIS AIO</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="password"
            required
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="rounded border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading ? 'Checking…' : 'Enter'}
          </button>
          {error && <p className="text-sm text-bad">{error}</p>}
        </form>
      </div>
    </div>
  );
}
