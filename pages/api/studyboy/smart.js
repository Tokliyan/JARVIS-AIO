// Smart Study — adaptive question batches and answer marking.
// POST { action: 'next', subject, sourceText, asked, focusTopics, level }
// POST { action: 'grade', subject, question, kind, modelAnswer, keyPoints, studentAnswer, attempt }
// Needs a signed-in session token (see lib/requireUser.js).

import { requireUser } from '@/lib/requireUser';
import { generateQuestions, gradeAnswer } from '@/lib/studyboySmart';

export const config = {
  api: { bodyParser: { sizeLimit: '2mb' } },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireUser(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const body = req.body || {};
  if (body.action === 'next') {
    const { status, body: out } = await generateQuestions(body);
    return res.status(status).json(out);
  }
  if (body.action === 'grade') {
    const { status, body: out } = await gradeAnswer(body);
    return res.status(status).json(out);
  }
  return res.status(400).json({ error: 'Unknown action.' });
}
