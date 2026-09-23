// The Satellite hardware POSTs here once it exists. No user session possible
// on a microcontroller, so this is gated by a shared secret header instead.
//
// POST /api/satellite/report
// Header: x-satellite-key: <SATELLITE_API_KEY>
// Body:   { "temperature_c": 22.4, "satellite_online": true, "camera_online": false, "mqtt_hub_online": true }

import { supabaseAdmin } from '@/lib/supabaseAdmin';

const OWNER_ID = '04b4fa14-b541-4b23-92d6-886d6202d727';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.SATELLITE_API_KEY || req.headers['x-satellite-key'] !== process.env.SATELLITE_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { temperature_c, satellite_online, camera_online, mqtt_hub_online } = req.body || {};

  let db;
  try {
    db = supabaseAdmin();
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  const { error } = await db.from('aio_room_readings').insert({
    user_id: OWNER_ID,
    temperature_c: temperature_c ?? null,
    satellite_online: !!satellite_online,
    camera_online: !!camera_online,
    mqtt_hub_online: !!mqtt_hub_online,
  });

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true });
}
