import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabaseClient';
import { Paperclip, ArrowUp, X, Loader2, FileText, ImageDown } from 'lucide-react';

function isoDaysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

const TEXT_TYPES = ['text/plain', 'text/markdown', 'text/csv', 'application/json'];
const MAX_TEXTAREA_HEIGHT = 200;

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });
}

const MIN_DIMENSION = 60; // below this in either direction, treat as unreadable

function checkImageResolution(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img.width >= MIN_DIMENSION && img.height >= MIN_DIMENSION);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(true); // can't tell — let the extraction step be the real check
    };
    img.src = url;
  });
}

export default function CommandBar() {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [files, setFiles] = useState([]); // { id, name, text, status: 'reading'|'ready'|'error' }
  const [dragging, setDragging] = useState(false);
  const dragCounter = useRef(0);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        textareaRef.current?.focus();
      }
      if (e.key === 'Escape') setResult(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Auto-grow the textarea as content wraps to new lines.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT) + 'px';
  }, [value]);

  async function ingestFiles(fileList) {
    const picked = Array.from(fileList || []);

    for (const file of picked) {
      const id = `${file.name}-${Date.now()}-${Math.random()}`;
      setFiles((prev) => [...prev, { id, name: file.name, text: '', status: 'reading' }]);

      try {
        if (file.type.startsWith('image/')) {
          const bigEnough = await checkImageResolution(file);
          if (!bigEnough) {
            throw new Error('lowres');
          }
        }

        let text;
        if (TEXT_TYPES.includes(file.type) || /\.(txt|md|csv|json)$/i.test(file.name)) {
          text = await file.text();
        } else if (file.size > 10 * 1024 * 1024) {
          throw new Error('toobig');
        } else {
          const base64 = await fileToBase64(file);
          const res = await fetch('/api/studyboy/extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ base64, mediaType: file.type }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Could not read that file.');
          text = data.text;
        }
        setFiles((prev) =>
          prev.map((f) => (f.id === id ? { ...f, text, status: 'ready' } : f)),
        );
      } catch (err) {
        const reason =
          err.message === 'lowres'
            ? 'too low-res to read'
            : err.message === 'toobig'
              ? 'over 10MB'
              : "couldn't read";
        setFiles((prev) =>
          prev.map((f) => (f.id === id ? { ...f, status: 'error', errorReason: reason } : f)),
        );
      }
    }
  }

  function handleFileInput(e) {
    ingestFiles(e.target.files);
    e.target.value = ''; // allow picking the same file again later
  }

  function removeFile(id) {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  function handleDragEnter(e) {
    e.preventDefault();
    if (e.dataTransfer.types?.includes('Files')) {
      dragCounter.current += 1;
      setDragging(true);
    }
  }
  function handleDragOver(e) {
    e.preventDefault();
  }
  function handleDragLeave(e) {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setDragging(false);
    }
  }
  function handleDrop(e) {
    e.preventDefault();
    dragCounter.current = 0;
    setDragging(false);
    if (e.dataTransfer.files?.length) ingestFiles(e.dataTransfer.files);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  async function handleSubmit(e) {
    e?.preventDefault?.();
    const typed = value.trim();
    const stillReading = files.some((f) => f.status === 'reading');
    if ((!typed && files.length === 0) || busy || stillReading) return;

    let text = typed;
    for (const f of files) {
      if (f.status === 'ready' && f.text) {
        text += `\n\n--- Attached: ${f.name} ---\n${f.text.slice(0, 8000)}`;
      }
    }

    setBusy(true);
    setResult(null);

    try {
      const res = await fetch('/api/command/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, today: new Date().toISOString().slice(0, 10) }),
      });
      const intent = await res.json();

      if (!res.ok) {
        setResult({ kind: 'error', message: intent.error || 'Something went wrong.' });
      } else {
        await runIntent(intent, text);
      }
    } catch (err) {
      setResult({ kind: 'error', message: err.message });
    } finally {
      setBusy(false);
      setFiles([]);
    }
  }

  async function runIntent(intent, rawText) {
    switch (intent.action) {
      case 'add_checklist': {
        const { error } = await supabase.from('aio_checklist').insert({
          title: intent.title,
          tag: intent.tag || 'General',
          due_date: intent.due_date || null,
          priority: intent.priority || 'med',
        });
        if (error) return setResult({ kind: 'error', message: error.message });
        setResult({
          kind: 'ok',
          message: `Added: ${intent.title}${intent.due_date ? ` — due ${intent.due_date}` : ''}`,
        });
        setValue('');
        router.replace(router.asPath, undefined, { scroll: false });
        break;
      }

      case 'complete_checklist': {
        const { data } = await supabase
          .from('aio_checklist')
          .select('*')
          .ilike('title', `%${intent.match}%`)
          .neq('status', 'done')
          .limit(1);
        if (!data || data.length === 0) {
          return setResult({ kind: 'error', message: `No open task matching "${intent.match}".` });
        }
        await supabase
          .from('aio_checklist')
          .update({ status: 'done', completed_at: new Date().toISOString() })
          .eq('id', data[0].id);
        setResult({ kind: 'ok', message: `Marked done: ${data[0].title}` });
        setValue('');
        router.replace(router.asPath, undefined, { scroll: false });
        break;
      }

      case 'add_period': {
        const { error } = await supabase.from('aio_timetable').insert({
          subject: intent.subject,
          day_of_week: intent.day_of_week,
          period_number: intent.period_number || 1,
          start_time: intent.start_time,
          end_time: intent.end_time,
          room: intent.room || null,
          week_type: intent.week || null,
        });
        if (error) return setResult({ kind: 'error', message: error.message });
        setResult({ kind: 'ok', message: `Added ${intent.subject} to the timetable.` });
        setValue('');
        router.replace(router.asPath, undefined, { scroll: false });
        break;
      }

      case 'bulk_add_periods': {
        const rows = (intent.periods || []).map((p) => ({
          subject: p.subject,
          day_of_week: p.day_of_week,
          period_number: p.period_number || 1,
          start_time: p.start_time,
          end_time: p.end_time,
          room: p.room || null,
          week_type: p.week || null,
        }));
        if (rows.length === 0) {
          return setResult({ kind: 'error', message: "Couldn't find any periods in that." });
        }
        const { error } = await supabase.from('aio_timetable').insert(rows);
        if (error) return setResult({ kind: 'error', message: error.message });
        setResult({ kind: 'ok', message: `Added ${rows.length} periods to the timetable.` });
        setValue('');
        router.replace(router.asPath, undefined, { scroll: false });
        break;
      }

      case 'log_project': {
        const { data } = await supabase
          .from('aio_projects')
          .select('id, name')
          .ilike('name', `%${intent.project_match}%`)
          .limit(1);
        if (!data || data.length === 0) {
          return setResult({
            kind: 'error',
            message: `No project matching "${intent.project_match}".`,
          });
        }
        const { error } = await supabase.from('aio_project_updates').insert({
          project_id: data[0].id,
          kind: intent.kind || 'note',
          body: intent.body,
        });
        if (error) return setResult({ kind: 'error', message: error.message });
        setResult({ kind: 'ok', message: `Logged to ${data[0].name}.` });
        setValue('');
        router.replace(router.asPath, undefined, { scroll: false });
        break;
      }

      case 'complete_routine': {
        const { data } = await supabase
          .from('aio_routine_defs')
          .select('*')
          .ilike('name', `%${intent.routine_match}%`)
          .eq('active', true)
          .limit(1);
        if (!data || data.length === 0) {
          return setResult({
            kind: 'error',
            message: `No routine matching "${intent.routine_match}".`,
          });
        }
        const { error } = await supabase.from('aio_routines').insert({
          routine_name: data[0].name,
          recurrence_days: data[0].recurrence_days,
          completed_at: new Date().toISOString().slice(0, 10),
        });
        setResult({
          kind: 'ok',
          message: error
            ? `${data[0].name} was already ticked off today.`
            : `${data[0].name} done.`,
        });
        setValue('');
        router.replace(router.asPath, undefined, { scroll: false });
        break;
      }

      case 'add_routine': {
        const { error } = await supabase.from('aio_routine_defs').insert({
          name: intent.name,
          time_of_day: intent.time_of_day || 'anytime',
          recurrence_days: intent.recurrence_days || 1,
        });
        if (error) return setResult({ kind: 'error', message: error.message });
        setResult({ kind: 'ok', message: `Added routine: ${intent.name}` });
        setValue('');
        router.replace(router.asPath, undefined, { scroll: false });
        break;
      }

      case 'open_studyboy': {
        setValue('');
        setResult({ kind: 'ok', message: 'Opening Studyboy — pick your material there.' });
        router.push('/studyboy');
        break;
      }

      case 'update_project': {
        const { data } = await supabase
          .from('aio_projects')
          .select('id, name')
          .ilike('name', `%${intent.project_match}%`)
          .limit(1);
        if (!data || data.length === 0) {
          return setResult({
            kind: 'error',
            message: `No project matching "${intent.project_match}".`,
          });
        }
        const { error } = await supabase
          .from('aio_projects')
          .update({ [intent.field]: intent.value, updated_at: new Date().toISOString() })
          .eq('id', data[0].id);
        if (error) return setResult({ kind: 'error', message: error.message });
        setResult({
          kind: 'ok',
          message: `Updated ${data[0].name}'s ${intent.field.replace('_', ' ')}.`,
        });
        setValue('');
        router.replace(router.asPath, undefined, { scroll: false });
        break;
      }

      case 'add_roadmap_item': {
        const { data } = await supabase
          .from('aio_projects')
          .select('id, name, roadmap')
          .ilike('name', `%${intent.project_match}%`)
          .limit(1);
        if (!data || data.length === 0) {
          return setResult({
            kind: 'error',
            message: `No project matching "${intent.project_match}".`,
          });
        }
        const roadmap = Array.isArray(data[0].roadmap) ? data[0].roadmap : [];
        const { error } = await supabase
          .from('aio_projects')
          .update({ roadmap: [...roadmap, { title: intent.title, status: intent.status || 'planned' }] })
          .eq('id', data[0].id);
        if (error) return setResult({ kind: 'error', message: error.message });
        setResult({ kind: 'ok', message: `Added to ${data[0].name}'s roadmap.` });
        setValue('');
        router.replace(router.asPath, undefined, { scroll: false });
        break;
      }

      case 'summary': {
        const target = intent.scope === 'tomorrow' ? isoDaysFromNow(1) : isoDaysFromNow(0);
        const dayNum = new Date(target).getDay();

        const [{ data: tasks }, { data: periods }] = await Promise.all([
          supabase.from('aio_checklist').select('*').eq('due_date', target),
          supabase.from('aio_timetable').select('*').eq('day_of_week', dayNum).order('period_number'),
        ]);

        setResult({
          kind: 'summary',
          scope: intent.scope,
          date: target,
          tasks: tasks || [],
          periods: periods || [],
        });
        break;
      }

      case 'process_notification': {
        const subjects = intent.subjects?.length ? intent.subjects : ['General'];

        // Save a copy into each relevant subject's saved material.
        await supabase.from('aio_studyboy_docs').insert(
          subjects.map((subj) => ({
            subject: subj,
            file_name: `Notification — ${new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`,
            source: 'command_bar',
            ocr_text: rawText,
          })),
        );

        // Add any real action items to the checklist.
        const items = intent.checklist_items || [];
        if (items.length > 0) {
          await supabase.from('aio_checklist').insert(
            items.map((it) => ({
              title: it.title,
              tag: `School · ${subjects[0]}`,
              due_date: it.due_date || null,
              priority: it.priority || 'med',
            })),
          );
        }

        // If it's clearly a dated assessment, build a study plan from it too.
        let planNote = '';
        if (intent.has_assessment && intent.assessment_date) {
          try {
            const planRes = await fetch('/api/studyboy/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                mode: 'study_plan',
                subject: subjects[0],
                sourceText: rawText,
                assessmentDate: intent.assessment_date,
                today: new Date().toISOString().slice(0, 10),
              }),
            });
            const plan = await planRes.json();
            if (planRes.ok && plan.steps?.length) {
              await supabase.from('aio_checklist').insert(
                plan.steps.map((s) => ({
                  title: s.title,
                  tag: `School · ${subjects[0]}`,
                  due_date: s.date,
                  priority: 'med',
                })),
              );
              await supabase.from('aio_studyboy_outputs').insert({
                subject: subjects[0],
                mode: 'study_plan',
                title: `${subjects[0]} — plan for ${intent.assessment_date}`,
                payload: plan,
              });
              planNote = ` Built a ${plan.steps.length}-step study plan too — check Studyboy's history.`;
            }
          } catch {
            // plan generation failing shouldn't block the save/checklist part
          }
        }

        setResult({
          kind: 'ok',
          message: `Saved to ${subjects.join(', ')}${items.length ? `, added ${items.length} task${items.length === 1 ? '' : 's'}` : ''}.${planNote}`,
        });
        setValue('');
        router.replace(router.asPath, undefined, { scroll: false });
        break;
      }

      case 'feature_request': {
        const { data } = await supabase
          .from('aio_projects')
          .select('id, roadmap')
          .eq('name', 'Ambient Intelligence')
          .limit(1);
        if (data && data.length > 0) {
          const roadmap = Array.isArray(data[0].roadmap) ? data[0].roadmap : [];
          await supabase
            .from('aio_projects')
            .update({
              roadmap: [
                ...roadmap,
                { title: intent.summary, status: 'planned', detail: 'Requested via command bar' },
              ],
            })
            .eq('id', data[0].id);
        }
        setResult({
          kind: 'ok',
          message: `Saved to Ambient Intelligence's roadmap: "${intent.summary}" — needs an actual build session, not something I can do live.`,
        });
        setValue('');
        break;
      }

      default:
        setResult({
          kind: 'error',
          message: intent.reason || "Didn't catch that — try rephrasing.",
        });
    }
  }

  const stillReading = files.some((f) => f.status === 'reading');
  const canSend = (value.trim() || files.length > 0) && !busy && !stillReading;

  return (
    <div className="fixed inset-x-0 bottom-0 border-t border-border bg-surface/95 backdrop-blur">
      <div className="mx-auto max-w-3xl px-4 py-3">
        {result && (
          <div className="mb-2 animate-row-in rounded border border-border bg-bg p-3 text-sm">
            {result.kind === 'summary' ? (
              <>
                <div className="mb-2 text-2xs uppercase tracking-wider text-faint">
                  {result.scope === 'tomorrow' ? 'Tomorrow' : 'Today'} · {result.date}
                </div>
                {result.periods.length > 0 && (
                  <div className="mb-2">
                    {result.periods.map((p) => (
                      <div key={p.id} className="flex gap-3 text-ink">
                        <span className="tnum w-14 text-xs text-muted">
                          {p.start_time?.slice(0, 5)}
                        </span>
                        {p.subject}
                      </div>
                    ))}
                  </div>
                )}
                {result.tasks.length > 0 ? (
                  result.tasks.map((t) => (
                    <div key={t.id} className="flex gap-2 text-ink">
                      <span className="text-muted">{t.status === 'done' ? '☑' : '☐'}</span>
                      {t.title}
                      <span className="ml-auto text-xs text-muted">{t.tag}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-muted">Nothing due.</div>
                )}
              </>
            ) : (
              <span className={result.kind === 'error' ? 'text-bad' : 'text-ink'}>
                {result.message}
              </span>
            )}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative flex flex-col gap-2 rounded-3xl border bg-bg px-3 py-2.5 shadow-sm transition-colors focus-within:border-muted/50 ${
            dragging ? 'border-accent bg-accent/5' : 'border-border'
          }`}
        >
          {dragging && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-bg/90">
              <span className="flex items-center gap-2 text-sm font-medium text-accent">
                <ImageDown size={16} />
                Drop to attach
              </span>
            </div>
          )}
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2 px-1 pt-0.5">
              {files.map((f) => (
                <div
                  key={f.id}
                  className="flex animate-row-in items-center gap-1.5 rounded-lg border border-border bg-surface py-1 pl-2 pr-1.5 text-xs"
                >
                  {f.status === 'reading' ? (
                    <Loader2 size={13} className="shrink-0 animate-spin text-faint" />
                  ) : (
                    <FileText
                      size={13}
                      className={`shrink-0 ${f.status === 'error' ? 'text-bad' : 'text-muted'}`}
                    />
                  )}
                  <span className="max-w-[9rem] truncate text-ink">
                    {f.status === 'error' ? `${f.name} — ${f.errorReason || "couldn't read"}` : f.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFile(f.id)}
                    aria-label={`Remove ${f.name}`}
                    className="rounded p-0.5 text-faint hover:bg-bg hover:text-ink"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".txt,.md,.csv,.json,.pdf,image/*"
              onChange={handleFileInput}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Attach a file"
              className="mb-0.5 shrink-0 rounded-full p-1.5 text-faint transition-colors hover:bg-border/50 hover:text-ink"
            >
              <Paperclip size={17} />
            </button>

            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={busy}
              rows={1}
              placeholder={
                busy ? 'Working…' : 'Add a task, log to a project, attach something, ask for a summary…'
              }
              className="max-h-[200px] flex-1 resize-none bg-transparent py-1 text-sm text-ink placeholder:text-faint focus:outline-none disabled:opacity-60"
            />

            <kbd className="mb-1.5 hidden shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] text-faint sm:block">
              ⌘K
            </kbd>

            <button
              type="submit"
              disabled={!canSend}
              aria-label="Send"
              className={`mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors ${
                canSend ? 'bg-ink text-bg hover:opacity-85' : 'bg-border text-faint'
              }`}
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <ArrowUp size={15} />}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
