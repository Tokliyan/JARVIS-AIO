import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import ProjectCard from '@/components/ProjectCard';

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('aio_projects')
      .select('*')
      .order('sort_order', { ascending: true });
    setProjects(data || []);
    setLoading(false);
  }

  return (
    <div>
      <h1 className="mb-1 text-lg font-medium text-ink">Projects</h1>
      <p className="mb-6 text-xs text-muted">
        Every active build in one place. Edit any card to update its status.
      </p>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : projects.length === 0 ? (
        <p className="text-sm text-muted">
          No projects yet — run the seed SQL to add them.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} onChange={load} />
          ))}
        </div>
      )}
    </div>
  );
}
