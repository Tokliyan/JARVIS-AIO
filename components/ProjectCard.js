import Link from 'next/link';
import Tile from '@/components/Tile';

const DOT = { good: 'bg-good', warn: 'bg-warn', bad: 'bg-bad', idle: 'bg-border' };

export default function ProjectCard({ project, index = 0 }) {
  const metrics = Array.isArray(project.metrics) ? project.metrics : [];
  const links = Array.isArray(project.links) ? project.links : [];

  return (
    <Link
      href={`/projects/${project.id}`}
      className="group flex animate-row-in flex-col rounded border border-border bg-surface p-4 transition-colors hover:border-rule"
      style={{ animationDelay: `${Math.min(index * 60, 300)}ms` }}
    >
      <div className="flex items-start gap-3">
        <Tile tag={project.name} />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-medium text-ink group-hover:underline">{project.name}</h2>
          <div className="mt-1 flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${DOT[project.status_color]}`} />
            <span className="text-xs text-muted">{project.status_label}</span>
          </div>
        </div>
      </div>

      {project.last_update && (
        <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted">
          {project.last_update}
        </p>
      )}

      {metrics.length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          {metrics.slice(0, 2).map((m, i) => {
            const pct = Math.min(((Number(m.value) || 0) / (Number(m.max) || 100)) * 100, 100);
            return (
              <div key={i}>
                <div className="mb-1 flex items-baseline justify-between text-xs">
                  <span className="truncate text-faint">{m.label}</span>
                  <span className="tnum shrink-0 text-muted">
                    {m.unit === '$' ? '$' : ''}
                    {m.value}
                    {m.unit && m.unit !== '$' ? m.unit : ''}
                  </span>
                </div>
                <div className="h-1 w-full overflow-hidden rounded-full bg-border">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
        <span className="text-xs text-faint">
          {links.length > 0 ? `${links.length} link${links.length === 1 ? '' : 's'}` : ' '}
        </span>
        <span className="text-xs text-muted transition-colors group-hover:text-accent">Open</span>
      </div>
    </Link>
  );
}
