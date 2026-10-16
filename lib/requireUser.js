// SERVER-ONLY. Confirms a request carries a valid Supabase session token.
// The site's login gate runs in the browser, so an API route that spends
// Anthropic credit has to check the token itself or anyone who finds the URL
// can use it. The browser sends its session token via lib/authedFetch.js.

import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function requireUser(req) {
  const header = req.headers?.authorization || '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  if (!token) return { ok: false, status: 401, error: 'Please sign in again.' };

  try {
    const { data, error } = await supabaseAdmin().auth.getUser(token);
    if (error || !data?.user) return { ok: false, status: 401, error: 'Please sign in again.' };
    return { ok: true, user: data.user };
  } catch (err) {
    return { ok: false, status: 500, error: err.message };
  }
}
