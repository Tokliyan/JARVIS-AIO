import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function RoomCard() {
  const [reading, setReading] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('aio_room_readings')
      .select('*')
      .order('recorded_at', { ascending: false })
      .limit(1);
    setReading(data && data[0] ? data[0] : null);
    setLoading(false);
  }

  return (
    <div className="rounded border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs text-muted">Room</span>
        {reading && (
          <span className="font-mono text-xs text-muted">
            {new Date(reading.recorded_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : reading ? (
        <>
          <div className="font-mono text-2xl text-ink">{reading.temperature_c}°C</div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <StatusDot label="Satellite" on={reading.satellite_online} />
            <StatusDot label="Camera" on={reading.camera_online} />
            <StatusDot label="MQTT hub" on={reading.mqtt_hub_online} />
          </div>
        </>
      ) : (
        <p className="text-sm text-muted">No readings yet — waiting on the Mechanic hardware.</p>
      )}
    </div>
  );
}

function StatusDot({ label, on }) {
  return (
    <span className="flex items-center gap-1.5 text-muted">
      <span className={`h-1.5 w-1.5 rounded-full ${on ? 'bg-good' : 'bg-border'}`} />
      {label}
    </span>
  );
}
