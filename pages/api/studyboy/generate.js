// Server-side only. Uses ANTHROPIC_API_KEY, never exposed to the browser.
// Everything generated here is grounded in `sourceText` — the user's own material —
// rather than the model's general knowledge. The prompts and the Claude call live in
// lib/studyboyGenerate.js so the Kindle command route builds material the same way.

import { generateStudyMaterial } from '@/lib/studyboyGenerate';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { status, body } = await generateStudyMaterial(req.body || {});
  return res.status(status).json(body);
}
