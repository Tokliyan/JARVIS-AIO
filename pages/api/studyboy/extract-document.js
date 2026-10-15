// Reads a Word (.docx) or PowerPoint (.pptx) file and returns its text.
// POST { base64, fileName } → { text }. Needs a signed-in session token.

import { requireUser } from '@/lib/requireUser';
import { extractDocument } from '@/lib/documentText';

export const config = {
  api: { bodyParser: { sizeLimit: '14mb' } },
};

const MAX_BYTES = 10 * 1024 * 1024;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireUser(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const { base64, fileName } = req.body || {};
  if (!base64 || !fileName) return res.status(400).json({ error: 'No file provided.' });

  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length > MAX_BYTES) {
    return res.status(413).json({ error: 'That file is over 10MB — try a smaller one.' });
  }

  const result = await extractDocument(buffer, fileName);
  if (result.error) return res.status(422).json({ error: result.error });
  return res.status(200).json({ text: result.text });
}
