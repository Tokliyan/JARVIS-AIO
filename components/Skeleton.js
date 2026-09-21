// Loading placeholders shaped like the content they stand in for, so a page
// doesn't reflow the moment data lands. Everything here is decorative — the
// announcement for screen readers comes from <SkeletonBlock>.

export function Skeleton({ className = '' }) {
  return <div aria-hidden="true" className={`animate-pulse-soft rounded bg-border ${className}`} />;
}

/** Wraps a set of skeletons and tells assistive tech that something is loading. */
export function SkeletonBlock({ label = 'Loading', className = '', children }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={className}>
      <span className="sr-only">{label}…</span>
      {children}
    </div>
  );
}

/** A few lines of fake text — last line short, the way real text ends. */
export function SkeletonText({ lines = 3, className = '' }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-3 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`}
        />
      ))}
    </div>
  );
}
