// SERVER-ONLY. Never import this from anything that runs in the browser —
// the service role key bypasses every Row Level Security policy. It exists
// because devices like the Kindle and the Satellite hardware have no user
// session to authenticate with; this is how they read/write anyway, gated
// by their own secret tokens instead of a login.
import { createClient } from '@supabase/supabase-js';

let cached = null;

export function supabaseAdmin() {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. Add it in Render — Settings/Environment.',
    );
  }

  cached = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}
