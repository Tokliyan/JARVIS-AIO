import TimeSpine from '@/components/TimeSpine';
import RoomCard from '@/components/RoomCard';
import RoutineStreaks from '@/components/RoutineStreaks';
import NeedsAttentionCard from '@/components/NeedsAttentionCard';
import SectionLabel from '@/components/SectionLabel';

export default function StatusPage() {
  const now = new Date();
  const weekday = now.toLocaleDateString('en-AU', { weekday: 'long' });
  const date = now.toLocaleDateString('en-AU', { day: 'numeric', month: 'long' });

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-8">
        <h1 className="text-2xl font-medium tracking-tight text-ink">{weekday}</h1>
        <p className="mt-0.5 text-sm text-muted">{date}</p>
      </header>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_15rem]">
        <section>
          <TimeSpine />
        </section>

        <aside className="flex flex-col gap-6 lg:border-l lg:border-border lg:pl-6">
          <div>
            <SectionLabel>Room</SectionLabel>
            <RoomCard />
          </div>
          <div>
            <SectionLabel>Routines</SectionLabel>
            <RoutineStreaks manage />
          </div>
          <div>
            <SectionLabel>Needs attention</SectionLabel>
            <NeedsAttentionCard />
          </div>
        </aside>
      </div>
    </div>
  );
}
