// Stand-in for the browser Supabase client in unit tests: anything that tries
// to reach the database fails loudly instead of needing env vars.
const fail = () => {
  throw new Error('supabase browser client is not available in unit tests');
};
export const supabase = new Proxy({}, { get: fail });
