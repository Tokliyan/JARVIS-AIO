// Reads handwritten notes, photos of textbook pages, or scanned PDFs and
// returns clean text. Uses Claude's vision capability, so handwriting works.
// Server-side only — the API key never reaches the browser.

export const config = {
  api: { bodyParser: { sizeLimit: '12mb' } },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'ANTHROPIC_API_KEY is not set. Add it as an environment variable in Render.',
    });
  }

  const { base64, mediaType } = req.body || {};
  if (!base64 || !mediaType) {
    return res.status(400).json({ error: 'No file provided.' });
  }

  const isPdf = mediaType === 'application/pdf';

  const block = isPdf
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
    : { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } };

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 8192,
        system: `Transcribe the study material in this document into clean, readable text.

Rules:
- Preserve structure: headings, numbered lists, question numbering, mark allocations.
- Transcribe formulas and equations in readable plain text or LaTeX-style notation.
- Describe diagrams briefly in square brackets, e.g. [Diagram: force vectors on an inclined plane].
- Do not summarise, do not add commentary, do not correct the content. Transcribe what's there.
- If handwriting is genuinely illegible, mark it [illegible] rather than guessing.`,
        messages: [
          {
            role: 'user',
            content: [block, { type: 'text', text: 'Transcribe this study material.' }],
          },
        ],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      return res.status(502).json({ error: 'Claude API error', detail });
    }

    const data = await response.json();
    const text = (data.content || [])
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('')
      .trim();

    return res.status(200).json({ text });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
