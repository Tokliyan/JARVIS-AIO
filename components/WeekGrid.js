import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

const DAYS = [
  { n: 1, short: 'Mon', long: 'Monday' },
  { n: 2, short: 'Tue', long: 'Tuesday' },
  { n: 3, short: 'Wed', long: 'Wednesday' },
  { n: 4, short: 'Thu', long: 'Thursday' },
  { n: 5, short: 'Fri', long: 'Friday' },
];

const EMPTY = {
  day_of_week: 1,
  period_number: 1,
  subject: '',
  room: '',
  teacher: '',
  start_time: '',
  end_time: '',
};

function toMinutes(t) {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function fmt(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const suffix = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')}${suffix}`;
}

export default function WeekGrid() {
  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [now, setNow] = useState(new Date());

  const todayNum = now.getDay();

  useEffect(() => {
    load();
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('aio_timetable')
      .select('*')
      .order('day_of_week')
      .order('start_time');
    setPeriods(data || []);
    setLoading(false);
  }

  async function addPeriod(e) {
    e.preventDefault();
    if (!form.subject.trim() || !form.start_time || !form.end_time) return;
    await supabase.from('aio_timetable').insert({
      ...form,
      day_of_week: Number(form.day_of_week),
      period_number: Number(form.period_number) || 1,
    });
    setForm({ ...EMPTY, day_of_week: form.day_of_week });
    load();
  }

  async function removePeriod(id) {
    await supabase.from('aio_timetable').delete().eq('id', id);
    load();
  }

  function openFormFor(dayNum) {
    setForm({ ...EMPTY, day_of_week: dayNum });
    setShowForm(true);
  }

  const nowMins = now.getHours() * 60 + now.getMinutes();
  const total = periods.length;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted">
          {loading ? 'Loading…' : `${total} period${total === 1 ? '' : 's'} this week`}
        </p>
        <button
          onClick={() => (showForm ? setShowForm(false) : openFormFor(todayNum >= 1 && todayNum <= 5 ? todayNum : 1))}
          className="rounded border border-border px-3 py-1.5 text-sm text-ink transition-colors hover:bg-bg"
        >
          {showForm ? 'Cancel' : 'Add period'}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={addPeriod}
          className="mb-5 flex animate-row-in flex-wrap gap-2 rounded border border-border bg-surface p-3"
        >
          <select
            value={form.day_of_week}
            onChange={(e) => setForm({ ...form, day_of_week: e.target.value })}
            className="rounded border border-border bg-bg px-2 py-1.5 text-sm"
          >
            {DAYS.map((d) => (
              <option key={d.n} value={d.n}>
                {d.long}
              </option>
            ))}
          </select>
          <input
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            placeholder="Subject"
            className="min-w-[8rem] flex-1 rounded border border-border bg-bg px-2 py-1.5 text-sm"
          />
          <input
            type="time"
            value={form.start_time}
            onChange={(e) => setForm({ ...form, start_time: e.target.value })}
            className="tnum rounded border border-border bg-bg px-2 py-1.5 text-sm"
          />
          <input
            type="time"
            value={form.end_time}
            onChange={(e) => setForm({ ...form, end_time: e.target.value })}
            className="tnum rounded border border-border bg-bg px-2 py-1.5 text-sm"
          />
          <input
            value={form.room}
            onChange={(e) => setForm({ ...form, room: e.target.value })}
            placeholder="Room"
            className="w-20 rounded border border-border bg-bg px-2 py-1.5 text-sm"
          />
          <input
            value={form.teacher}
            onChange={(e) => setForm({ ...form, teacher: e.target.value })}
            placeholder="Teacher"
            className="w-28 rounded border border-border bg-bg px-2 py-1.5 text-sm"
          />
          <button
            type="submit"
            className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-white"
          >
            Save
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
        {DAYS.map((day, di) => {
          const isToday = day.n === todayNum;
          const dayPeriods = periods.filter((p) => p.day_of_week === day.n);

          return (
            <div
              key={day.n}
              className={`animate-row-in rounded border p-3 ${
                isToday ? 'border-accent/40 bg-surface' : 'border-border bg-surface'
              }`}
              style={{ animationDelay: `${di * 50}ms` }}
            >
              <div className="mb-3 flex items-baseline justify-between">
                <span
                  className={`text-2xs uppercase tracking-wider ${
                    isToday ? 'font-medium text-accent' : 'text-faint'
                  }`}
                >
                  {day.short}
                </span>
                <span className="tnum text-2xs text-faint">{dayPeriods.length || ''}</span>
              </div>

              {dayPeriods.length === 0 ? (
                <button
                  onClick={() => openFormFor(day.n)}
                  className="w-full rounded border border-dashed border-border py-3 text-xs text-faint transition-colors hover:border-rule hover:text-muted"
                >
                  Add
                </button>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {dayPeriods.map((p) => {
                    const live =
                      isToday &&
                      toMinutes(p.start_time) <= nowMins &&
                      toMinutes(p.end_time) >= nowMins;
                    const past = isToday && toMinutes(p.end_time) < nowMins;

                    return (
                      <div
                        key={p.id}
                        className={`group relative rounded p-2 transition-colors ${
                          live
                            ? 'bg-accent/8 ring-1 ring-accent/30'
                            : past
                              ? 'bg-bg opacity-55'
                              : 'bg-bg hover:bg-border/40'
                        }`}
                      >
                        <div className="flex items-baseline justify-between gap-1">
                          <span
                            className={`truncate text-xs ${live ? 'font-medium text-ink' : 'text-ink'}`}
                          >
                            {p.subject}
                          </span>
                          {live && <span className="shrink-0 text-2xs text-accent">now</span>}
                        </div>
                        <div className="tnum mt-0.5 text-2xs text-faint">
                          {fmt(p.start_time)}
                          {p.room ? ` · ${p.room}` : ''}
                        </div>
                        <button
                          onClick={() => removePeriod(p.id)}
                          aria-label={`Remove ${p.subject}`}
                          className="absolute right-1 top-1 text-faint opacity-0 transition-opacity hover:text-bad group-hover:opacity-100"
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
