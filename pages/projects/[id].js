import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import Tile from '@/components/Tile';
import SectionLabel from '@/components/SectionLabel';
import { BarRow } from '@/components/charts';
import ActivityTimeline from '@/components/ActivityTimeline';
import MetricsEditor from '@/components/MetricsEditor';
import RoadmapEditor from '@/components/RoadmapEditor';
import ProjectNotes from '@/components/ProjectNotes';

const DOT = { good: 'bg-good', warn: 'bg-warn', bad: 'bg-bad', idle: 'bg-border' };
const TABS = ['Overview', 'Roadmap', 'Activity', 'Metrics'];

export default function ProjectDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('Overview');

  useEffect(() => {
    if (!id) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function load() {
    const { data } = await supabase.from('aio_projects').select('*').eq('id', id).single();
    setProject(data);
    setLoading(false);
  }

  if (loading) return <p className="text-sm text-muted">Loading…</p>;
  if (!project) {
    return (
      <div>
        <p className="text-sm text-ink">That project doesn&rsquo;t exist.</p>
        <Link href="/projects" className="mt-2 inline-block text-sm text-accent hover:underline">
          Back to projects
        </Link>
      </div>
    );
  }

  const links = Array.isArray(project.links) ? project.links : [];
  const metrics = Array.isArray(project.metrics) ? project.metrics : [];

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/projects" className="text-xs text-muted hover:text-ink">
        ← Projects
      </Link>

      <header className="mb-6 mt-4 flex items-start gap-4">
        <Tile tag={project.name} />
        <div className="flex-1">
          <h1 className="text-2xl font-medium tracking-tight text-ink">{project.name}</h1>
          <div className="mt-1 flex items-center gap-2">
            <span className={`h-1.5 w-1.5 rounded-full ${DOT[project.status_color]}`} />
            <span className="text-sm text-muted">{project.status_label}</span>
          </div>
        </div>
      </header>

      <div className="mb-6 flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
              tab === t
                ? 'border-accent font-medium text-ink'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Overview' && (
        <div className="flex animate-row-in flex-col gap-8">
          {project.last_update && (
            <section>
              <SectionLabel>Where it&rsquo;s at</SectionLabel>
              <p className="max-w-prose whitespace-pre-line text-sm leading-relaxed text-ink">
                {project.last_update}
              </p>
            </section>
          )}

          {metrics.length > 0 && (
            <section>
              <SectionLabel>At a glance</SectionLabel>
              <div className="flex max-w-md flex-col gap-3">
                {metrics.map((m, i) => (
                  <BarRow
                    key={i}
                    label={m.label}
                    value={`${m.unit === '$' ? '$' : ''}${m.value}${m.unit && m.unit !== '$' ? m.unit : ''}`}
                    max={m.max}
                  />
                ))}
              </div>
            </section>
          )}

          {links.length > 0 && (
            <section>
              <SectionLabel>Links</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {links.map((l) => (
                  <a
                    key={l.url}
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded border border-border px-3 py-1.5 text-sm text-ink transition-colors hover:bg-bg"
                  >
                    {l.label}
                  </a>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {tab === 'Roadmap' && (
        <div className="flex animate-row-in flex-col gap-10">
          <RoadmapEditor project={project} onChange={load} />
          <div className="border-t border-border pt-8">
            <ProjectNotes project={project} onChange={load} />
          </div>
        </div>
      )}

      {tab === 'Activity' && (
        <div className="animate-row-in">
          <ActivityTimeline projectId={project.id} />
        </div>
      )}

      {tab === 'Metrics' && (
        <div className="animate-row-in">
          <MetricsEditor project={project} onChange={load} />
        </div>
      )}
    </div>
  );
}
