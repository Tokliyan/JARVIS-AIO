// Test-only module hooks: resolve the app's "@/..." alias and let tests swap
// out the Supabase admin client.
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const root = path.resolve(import.meta.dirname, '..');

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    let p = path.join(root, specifier.slice(2));
    if (!path.extname(p) || !fs.existsSync(p)) {
      if (fs.existsSync(p + '.js')) p += '.js';
    }
    if (specifier === '@/lib/supabaseAdmin') {
      return { url: pathToFileURL(path.join(root, 'tests/fakeSupabaseAdmin.mjs')).href, shortCircuit: true };
    }
    return { url: pathToFileURL(p).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
