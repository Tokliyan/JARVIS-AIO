import Checklist from '@/components/Checklist';
import Timetable from '@/components/Timetable';

export default function TimetablePage() {
  return (
    <div className="flex flex-col gap-8">
      <Timetable />
      <Checklist />
    </div>
  );
}
