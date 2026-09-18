'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

const DAY_LABELS = { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri' };

const EMPTY_FORM = {
  day_of_week: 1,
  period_number: 1,
  subject: '',
  room: '',
  teacher: '',
  start_time: '',
  end_time: '',
};

export default function Timetable() {
  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('aio_timetable')
      .select('*')
      .order('day_of_week')
      .order('period_number');
    if (!error) setPeriods(data);
    setLoading(false);
  }

  async function addPeriod(e) {
    e.preventDefault();
    if (!form.subject.trim() || !form.start_time || !form.end_time) return;
    const { error } = await supabase.from('aio_timetable').insert({
      ...form,
      day_of_week: Number(form.day_of_week),
      period_number: Number(form.period_number),
    });
    if (!error) {
      setForm(EMPTY_FORM);
      setShowForm(false);
      load();
    }
  }

  async function removePeriod(id) {
    await supabase.from('aio_timetable').delete().eq('id', id);
    load();
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-ink">Timetable</h2>
        <button onClick={() => setShowForm((s) => !s)} className="text-xs text-accent">
          {showForm ? 'Cancel' : '+ Add period'}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={addPeriod}
          className="mb-4 flex flex-wrap gap-2 rounded border border-border bg-surface p-3"
        >
          <select
            value={form.day_of_week}
            onChange={(e) => setForm({ ...form, day_of_week: e.target.value })}
            className="rounded border border-border px-2 py-1.5 text-sm"
          >
            {Object.entries(DAY_LABELS).map(([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </select>
          <input
            type="number"
            min="1"
            value={form.period_number}
            onChange={(e) => setForm({ ...form, period_number: e.target.value })}
            placeholder="Period #"
            className="w-24 rounded border border-border px-2 py-1.5 text-sm"
          />
          <input
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            placeholder="Subject"
            className="min-w-[100px] flex-1 rounded border border-border px-2 py-1.5 text-sm"
          />
          <input
            value={form.room}
            onChange={(e) => setForm({ ...form, room: e.target.value })}
            placeholder="Room"
            className="w-20 rounded border border-border px-2 py-1.5 text-sm"
          />
          <input
            value={form.teacher}
            onChange={(e) => setForm({ ...form, teacher: e.target.value })}
            placeholder="Teacher"
            className="w-32 rounded border border-border px-2 py-1.5 text-sm"
          />
          <input
            type="time"
            value={form.start_time}
            onChange={(e) => setForm({ ...form, start_time: e.target.value })}
            className="rounded border border-border px-2 py-1.5 text-sm"
          />
          <input
            type="time"
            value={form.end_time}
            onChange={(e) => setForm({ ...form, end_time: e.target.value })}
            className="rounded border border-border px-2 py-1.5 text-sm"
          />
          <button
            type="submit"
            className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-white"
          >
            Save
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <div className="grid grid-cols-5 gap-2">
          {Object.entries(DAY_LABELS).map(([dayNum, label]) => (
            <div key={dayNum} className="rounded border border-border bg-surface p-2">
              <div className="mb-2 text-2xs uppercase tracking-wider text-faint">{label}</div>
              <div className="flex flex-col gap-1.5">
                {periods
                  .filter((p) => p.day_of_week === Number(dayNum))
                  .map((p) => (
                    <div key={p.id} className="group relative rounded bg-bg p-1.5 text-xs">
                      <div className="font-medium text-ink">{p.subject}</div>
                      <div className="tnum text-faint">
                        {p.start_time?.slice(0, 5)}
                        {p.room ? ` · ${p.room}` : ''}
                      </div>
                      <button
                        onClick={() => removePeriod(p.id)}
                        className="absolute right-1 top-1 hidden text-muted hover:text-bad group-hover:block"
                      >
                        ×
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
