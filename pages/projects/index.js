import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import ProjectCard from '@/components/ProjectCard';
import { Skeleton, SkeletonBlock } from '@/components/Skeleton';

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('aio_projects')
        .select('*')
        .order('sort_order', { ascending: true });
      setProjects(data || []);
      setLoading(false);
    })();
  }, []);

  const flagged = projects.filter((p) => p.status_color === 'warn' || p.status_color === 'bad');

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-8">
        <h1 className="text-2xl font-medium tracking-tight text-ink">Projects</h1>
        {loading ? (
          <Skeleton className="mt-1.5 h-3.5 w-40" />
        ) : (
          <p className="mt-0.5 text-sm text-muted">
            {flagged.length > 0
              ? `${flagged.length} need${flagged.length === 1 ? 's' : ''} attention`
              : 'Everything running clean'}
          </p>
        )}
      </header>

      {loading ? (
        <SkeletonBlock
          label="Loading your projects"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <ProjectCardSkeleton key={i} />
          ))}
        </SkeletonBlock>
      ) : projects.length === 0 ? (
        <p className="text-sm text-muted">No projects yet — run the seed SQL to add them.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {projects.map((p, i) => (
            <ProjectCard key={p.id} project={p} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

// Mirrors ProjectCard's layout: tile, name + status dot, blurb, two metric bars,
// then the footer rule.
function ProjectCardSkeleton() {
  return (
    <div className="flex flex-col rounded border border-border bg-surface p-4">
      <div className="flex items-start gap-3">
        <Skeleton className="h-9 w-9 shrink-0" />
        <div className="min-w-0 flex-1">
          <Skeleton className="h-3.5 w-28" />
          <div className="mt-2 flex items-center gap-1.5">
            <Skeleton className="h-1.5 w-1.5 rounded-full" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-1.5">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {[0, 1].map((i) => (
          <div key={i}>
            <div className="mb-1 flex items-baseline justify-between">
              <Skeleton className="h-2.5 w-16" />
              <Skeleton className="h-2.5 w-8" />
            </div>
            <Skeleton className="h-1 w-full rounded-full" />
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
        <Skeleton className="h-2.5 w-12" />
        <Skeleton className="h-2.5 w-8" />
      </div>
    </div>
  );
}
