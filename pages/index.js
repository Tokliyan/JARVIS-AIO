import WeekGrid from '@/components/WeekGrid';
import Checklist from '@/components/Checklist';
import SectionLabel from '@/components/SectionLabel';

export default function TimetablePage() {
  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <h1 className="text-2xl font-medium tracking-tight text-ink">Timetable</h1>
        <p className="mt-0.5 text-sm text-muted">Your week, and everything on the list.</p>
      </header>

      <section className="mb-10">
        <WeekGrid />
      </section>

      <section>
        <SectionLabel>Everything on the list</SectionLabel>
        <Checklist />
      </section>
    </div>
  );
}
