import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Sparkline } from '@/components/charts';
import { Skeleton, SkeletonBlock } from '@/components/Skeleton';

// Glenwood NSW 2768. Open-Meteo needs no API key and allows browser calls
// directly, so this runs client-side with nothing to configure.
const GLENWOOD = { lat: -33.734, lon: 150.947 };

const WEATHER_LABEL = {
  0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Foggy', 48: 'Foggy',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow',
  80: 'Rain showers', 81: 'Rain showers', 82: 'Heavy showers',
  95: 'Thunderstorm',
};

export default function RoomCard() {
  const [weather, setWeather] = useState(null);
  const [weatherFailed, setWeatherFailed] = useState(false);
  const [readings, setReadings] = useState([]);
  const [loadingReadings, setLoadingReadings] = useState(true);

  useEffect(() => {
    fetchWeather();
    loadReadings();
  }, []);

  async function fetchWeather() {
    try {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${GLENWOOD.lat}&longitude=${GLENWOOD.lon}&current=temperature_2m,weather_code&timezone=Australia%2FSydney`,
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      setWeather(data.current);
    } catch {
      setWeatherFailed(true);
    }
  }

  async function loadReadings() {
    const { data } = await supabase
      .from('aio_room_readings')
      .select('*')
      .order('recorded_at', { ascending: false })
      .limit(24);
    setReadings((data || []).reverse());
    setLoadingReadings(false);
  }

  const latest = readings[readings.length - 1];
  const temps = readings.map((r) => r.temperature_c).filter((v) => v != null);

  if (loadingReadings && !weather && !weatherFailed) {
    return (
      <SkeletonBlock label="Loading the room">
        <div className="flex items-end justify-between">
          <div>
            <Skeleton className="h-7 w-14" />
            <Skeleton className="mt-1.5 h-3 w-28" />
          </div>
          <Skeleton className="h-5 w-16" />
        </div>
        <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
          {['w-16', 'w-14', 'w-10'].map((w) => (
            <div key={w} className="flex items-center gap-2">
              <Skeleton className="h-1.5 w-1.5 shrink-0 rounded-full" />
              <Skeleton className={`h-3 ${w}`} />
            </div>
          ))}
        </div>
      </SkeletonBlock>
    );
  }

  return (
    <div>
      <div className="flex items-end justify-between">
        <div>
          <span className="tnum text-2xl font-medium text-ink">
            {weather ? `${Math.round(weather.temperature_2m)}°` : weatherFailed ? '—' : '···'}
          </span>
          <div className="text-xs text-faint">
            {weather ? WEATHER_LABEL[weather.weather_code] || '' : 'Glenwood NSW'}
            {weather && ' · Glenwood NSW'}
          </div>
        </div>
        {temps.length > 1 && <Sparkline values={temps} width={64} height={20} />}
      </div>

      <div className="mt-3 flex flex-col gap-1.5 border-t border-border pt-3">
        <Status label="Satellite" on={latest?.satellite_online} />
        <Status label="Camera" on={latest?.camera_online} />
        <Status label="Hub" on={latest?.mqtt_hub_online} />
      </div>
      {!loadingReadings && !latest && (
        <p className="mt-2 text-2xs text-faint">Devices connect once the Satellite is built.</p>
      )}
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
