import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { BarRow } from '@/components/charts';

export default function MetricsEditor({ project, onChange }) {
  const [metrics, setMetrics] = useState(
    Array.isArray(project.metrics) ? project.metrics : [],
  );
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  function update(i, field, value) {
    const next = metrics.map((m, idx) => (idx === i ? { ...m, [field]: value } : m));
    setMetrics(next);
    setDirty(true);
  }

  function add() {
    setMetrics([...metrics, { label: '', value: 0, max: 100, unit: '' }]);
    setDirty(true);
  }

  function remove(i) {
    setMetrics(metrics.filter((_, idx) => idx !== i));
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    const clean = metrics
      .filter((m) => m.label.trim())
      .map((m) => ({
        label: m.label.trim(),
        value: Number(m.value) || 0,
        max: Number(m.max) || 100,
        unit: m.unit || '',
      }));
    await supabase
      .from('aio_projects')
      .update({ metrics: clean, updated_at: new Date().toISOString() })
      .eq('id', project.id);
    setSaving(false);
    setDirty(false);
    onChange?.();
  }

  return (
    <div className="flex flex-col gap-6">
      {metrics.length > 0 && (
        <div className="flex max-w-md flex-col gap-3 rounded border border-border bg-surface p-4">
          {metrics
            .filter((m) => m.label.trim())
            .map((m, i) => (
              <BarRow
                key={i}
                label={m.label}
                value={`${m.unit === '$' ? '$' : ''}${m.value}${m.unit && m.unit !== '$' ? m.unit : ''}`}
                max={Number(m.max) || 100}
              />
            ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {metrics.map((m, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={m.label}
              onChange={(e) => update(i, 'label', e.target.value)}
              placeholder="What you're tracking"
              className="flex-1 rounded border border-border bg-surface px-2 py-1.5 text-sm"
            />
            <input
              type="number"
              value={m.value}
              onChange={(e) => update(i, 'value', e.target.value)}
              className="tnum w-20 rounded border border-border bg-surface px-2 py-1.5 text-sm"
            />
            <span className="text-xs text-faint">of</span>
            <input
              type="number"
              value={m.max}
              onChange={(e) => update(i, 'max', e.target.value)}
              className="tnum w-20 rounded border border-border bg-surface px-2 py-1.5 text-sm"
            />
            <input
              value={m.unit}
              onChange={(e) => update(i, 'unit', e.target.value)}
              placeholder="unit"
              className="w-16 rounded border border-border bg-surface px-2 py-1.5 text-sm"
            />
            <button
              onClick={() => remove(i)}
              className="px-1 text-sm text-faint transition-colors hover:text-bad"
              aria-label="Remove metric"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={add}
          className="rounded border border-border px-3 py-1.5 text-sm text-ink transition-colors hover:bg-bg"
        >
          Add metric
        </button>
        {dirty && (
          <button
            onClick={save}
            disabled={saving}
            className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        )}
      </div>

      {metrics.length === 0 && (
        <p className="text-sm text-muted">
          No metrics yet. Add one to track a number that matters for this project.
        </p>
      )}
    </div>
  );
}
