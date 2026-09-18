import RoomCard from '@/components/RoomCard';
import TodayScheduleCard from '@/components/TodayScheduleCard';
import TodayChecklistCard from '@/components/TodayChecklistCard';
import NeedsAttentionCard from '@/components/NeedsAttentionCard';

export default function StatusPage() {
  const today = new Date().toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div>
      <h1 className="mb-1 text-lg font-medium text-ink">Daily Status</h1>
      <p className="mb-6 font-mono text-xs text-muted">{today}</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <RoomCard />
        <TodayScheduleCard />
        <TodayChecklistCard />
      </div>

      <div className="mt-4">
        <NeedsAttentionCard />
      </div>
    </div>
  );
}
