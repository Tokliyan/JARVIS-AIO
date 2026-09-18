import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import ProjectCard from '@/components/ProjectCard';

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
        <p className="mt-0.5 text-sm text-muted">
          {loading
            ? 'Loading…'
            : flagged.length > 0
              ? `${flagged.length} need${flagged.length === 1 ? 's' : ''} attention`
              : 'Everything running clean'}
        </p>
      </header>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
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
