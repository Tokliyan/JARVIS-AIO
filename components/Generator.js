import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Flashcards from '@/components/Flashcards';
import Quiz from '@/components/Quiz';

const MODES = [
  { id: 'past_paper', label: 'Past paper' },
  { id: 'study_guide', label: 'Study guide' },
  { id: 'flashcards', label: 'Flashcards' },
  { id: 'quiz', label: 'Quiz' },
  { id: 'study_plan', label: 'Study plan' },
];

export default function Generator({ subject, sourceText, onSaved, initialOutput }) {
  const [mode, setMode] = useState('past_paper');
  const [notes, setNotes] = useState('');
  const [assessmentDate, setAssessmentDate] = useState('');
  const [difficulty, setDifficulty] = useState('match');
  const [strictness, setStrictness] = useState('strict');
  const [busy, setBusy] = useState(false);
  const [output, setOutput] = useState(initialOutput || null);
  const [error, setError] = useState(null);
  const [addedToChecklist, setAddedToChecklist] = useState(false);

  async function generate() {
    setBusy(true);
    setError(null);
    setOutput(null);
    setAddedToChecklist(false);

    try {
      const res = await fetch('/api/studyboy/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          subject,
          sourceText,
          notes,
          assessmentDate,
          difficulty,
          strictness,
          today: new Date().toISOString().slice(0, 10),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong.');
      } else {
        setOutput(data);
        save(data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function save(data) {
    const label = MODES.find((m) => m.id === data.mode)?.label || 'Output';
    const stamp = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
    const { error } = await supabase.from('aio_studyboy_outputs').insert({
      subject: subject || null,
      mode: data.mode,
      title: `${subject ? subject + ' — ' : ''}${label}, ${stamp}`,
      payload: data,
    });
    if (!error) onSaved?.();
  }

  async function addPlanToChecklist() {
    if (!output?.steps) return;
    const rows = output.steps.map((s) => ({
      title: s.title,
      tag: `School · ${subject || 'Study'}`,
      due_date: s.date,
      priority: 'med',
    }));
    const { error } = await supabase.from('aio_checklist').insert(rows);
    if (error) setError(error.message);
    else setAddedToChecklist(true);
  }

  const canGenerate =
    sourceText.trim().length >= 50 && (mode !== 'study_plan' || assessmentDate) && !busy;

  return (
    <div className="rounded border border-border bg-surface p-4">
      <h2 className="mb-3 text-sm font-medium text-ink">Generate</h2>

      <div className="mb-3 flex flex-wrap gap-1">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => {
              setMode(m.id);
              setOutput(null);
            }}
            className={`rounded px-3 py-1.5 text-sm transition-colors ${
              mode === m.id ? 'bg-accent text-white' : 'border border-border text-ink hover:bg-bg'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        {mode === 'study_plan' ? (
          <label className="flex items-center gap-2 text-xs text-muted">
            Assessment date
            <input
              type="date"
              value={assessmentDate}
              onChange={(e) => setAssessmentDate(e.target.value)}
              className="rounded border border-border bg-bg px-2 py-1.5 text-sm text-ink"
            />
          </label>
        ) : (
          <label className="flex items-center gap-2 text-xs text-muted">
            Difficulty
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="rounded border border-border bg-bg px-2 py-1.5 text-sm text-ink"
            >
              <option value="easier">Easier</option>
              <option value="match">Match my notes</option>
              <option value="harder">Harder</option>
            </select>
          </label>
        )}

        <label className="flex items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            checked={strictness === 'strict'}
            onChange={(e) => setStrictness(e.target.checked ? 'strict' : 'extend')}
            className="h-3.5 w-3.5"
          />
          Stick to my notes only
        </label>
      </div>

      <input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Anything specific? (e.g. focus on trig identities)"
        className="mb-3 w-full rounded border border-border bg-bg px-3 py-2 text-sm placeholder:text-muted"
      />

      <button
        onClick={generate}
        disabled={!canGenerate}
        className="rounded bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-50"
      >
        {busy ? 'Generating…' : 'Generate'}
      </button>

      {sourceText.trim().length < 50 && (
        <p className="mt-2 text-xs text-muted">Add source material above first.</p>
      )}

      {error && <p className="mt-3 text-sm text-bad">{error}</p>}

      {output && (
        <div className="mt-4 border-t border-border pt-4">
          {output.mode === 'flashcards' ? (
            <Flashcards cards={output.cards || []} />
          ) : output.mode === 'quiz' ? (
            <Quiz questions={output.questions || []} />
          ) : output.mode === 'study_plan' ? (
            <>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs text-muted">{output.steps?.length || 0} steps</span>
                <button
                  onClick={addPlanToChecklist}
                  disabled={addedToChecklist}
                  className="rounded border border-border px-3 py-1.5 text-xs text-ink hover:bg-bg disabled:opacity-50"
                >
                  {addedToChecklist ? 'Added to checklist ✓' : 'Add all to checklist'}
                </button>
              </div>
              <ul className="flex flex-col divide-y divide-border rounded border border-border">
                {(output.steps || []).map((s, i) => (
                  <li key={i} className="flex gap-3 px-3 py-2 text-sm">
                    <span className="w-20 shrink-0 font-mono text-xs text-muted">{s.date}</span>
                    <div>
                      <div className="text-ink">{s.title}</div>
                      {s.detail && <div className="text-xs text-muted">{s.detail}</div>}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs text-muted">Saved to history</span>
                <button
                  onClick={() => navigator.clipboard.writeText(output.text)}
                  className="text-xs text-accent hover:underline"
                >
                  Copy
                </button>
              </div>
              <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap rounded border border-border bg-bg p-3 font-mono text-xs leading-relaxed text-ink">
                {output.text}
              </pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}
