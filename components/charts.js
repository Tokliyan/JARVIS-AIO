// Small, flat, two-colour charts. No shadows, no gradients, no chart library.
// Each one sits above real data rather than replacing it.

export function ProgressRing({ done, total, size = 44 }) {
  const pct = total === 0 ? 0 : done / total;
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E6E4E0" strokeWidth="3" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#2F6F4E"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - c * pct}
          style={{ transition: 'stroke-dashoffset 600ms cubic-bezier(0.2,0.8,0.2,1)' }}
        />
      </svg>
      <span className="tnum absolute inset-0 flex items-center justify-center text-[11px] text-ink">
        {total === 0 ? '—' : `${done}/${total}`}
      </span>
    </div>
  );
}

export function StreakStrip({ days }) {
  // days: array of booleans, oldest first
  return (
    <div className="flex items-center gap-1">
      {days.map((on, i) => (
        <span
          key={i}
          title={on ? 'Done' : 'Missed'}
          className={`h-2 w-2 rounded-full transition-colors ${on ? 'bg-accent' : 'bg-border'}`}
        />
      ))}
    </div>
  );
}

export function Sparkline({ values, width = 96, height = 24 }) {
  if (!values || values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((v - min) / span) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke="#2F6F4E"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BarRow({ label, value, max, tone = 'accent' }) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100);
  const color = { accent: 'bg-accent', warn: 'bg-warn', bad: 'bg-bad' }[tone] || 'bg-accent';
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="text-ink">{label}</span>
        <span className="tnum text-muted">{value}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${pct}%`, transition: 'width 600ms cubic-bezier(0.2,0.8,0.2,1)' }}
        />
      </div>
    </div>
  );
}
