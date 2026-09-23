// The trmnl-koreader plugin doesn't fetch an image directly — it calls
// GET <base_url>/api/display expecting JSON with an image_url field, then
// fetches that URL separately. This is that wrapper. No auth, matching the
// PNG route it points to — the plugin can't send custom auth headers anyway.

export default function handler(req, res) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers.host;

  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    image_url: `${proto}://${host}/api/eink/today.png`,
    refresh_rate: 900, // 15 minutes - schedule/tasks don't need faster than this
    filename: 'jarvis-today',
  });
}
