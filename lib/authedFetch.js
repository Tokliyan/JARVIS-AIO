// Browser-side fetch that attaches the signed-in user's Supabase session token,
// for API routes protected by lib/requireUser.js.
import { supabase } from '@/lib/supabaseClient';

export async function authedFetch(url, init = {}) {
  let token = null;
  try {
    const { data } = await supabase.auth.getSession();
    token = data?.session?.access_token || null;
  } catch {
    // fall through: the server will answer 401 and the UI shows it
  }
  return fetch(url, {
    ...init,
    headers: { ...(init.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
}
