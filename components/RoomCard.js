import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Sparkline } from '@/components/charts';

export default function RoomCard() {
  const [readings, setReadings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('aio_room_readings')
        .select('*')
        .order('recorded_at', { ascending: false })
        .limit(24);
      setReadings((data || []).reverse());
      setLoading(false);
    })();
  }, []);

  if (loading) return <p className="text-sm text-muted">Loading…</p>;

  const latest = readings[readings.length - 1];

  if (!latest) {
    return (
      <p className="text-sm text-muted">
        No readings yet. Starts once the Smart Satellite is running.
      </p>
    );
  }

  const temps = readings.map((r) => r.temperature_c).filter((v) => v != null);

  return (
    <div>
      <div className="flex items-end justify-between">
        <span className="tnum text-2xl font-medium text-ink">{latest.temperature_c}°</span>
        {temps.length > 1 && <Sparkline values={temps} width={80} height={22} />}
      </div>
      <div className="mt-3 flex flex-col gap-1.5">
        <Status label="Satellite" on={latest.satellite_online} />
        <Status label="Camera" on={latest.camera_online} />
        <Status label="Hub" on={latest.mqtt_hub_online} />
      </div>
    </div>
  );
}

function Status({ label, on }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={`h-1.5 w-1.5 rounded-full ${on ? 'bg-accent' : 'bg-border'}`} />
      <span className={on ? 'text-ink' : 'text-faint'}>{label}</span>
    </div>
  );
}
