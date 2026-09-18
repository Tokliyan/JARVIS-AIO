import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabaseClient';

export default function AuthGate({ children }) {
  const router = useRouter();
  const [status, setStatus] = useState('checking'); // checking | ok | redirecting

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      if (session) {
        setStatus('ok');
      } else {
        setStatus('redirecting');
        router.replace('/login');
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setStatus('redirecting');
        router.replace('/login');
      } else {
        setStatus('ok');
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [router]);

  if (status !== 'ok') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted">
          {status === 'checking' ? 'Checking session…' : 'Redirecting to sign in…'}
        </p>
      </div>
    );
  }

  return children;
}
