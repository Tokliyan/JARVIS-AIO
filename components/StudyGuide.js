import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Check,
  Copy,
  Download,
  HelpCircle,
  Layers,
  Lightbulb,
  Printer,
  Sparkles,
} from 'lucide-react';
import Markdown from '@/components/Markdown';
import { addCards } from '@/lib/cards';
import { recordAttempts } from '@/lib/attempts';
import { glossary, guideCards, guideStats, guideToMarkdown, topicAnchor } from '@/lib/studyGuide';

// The study guide reader. Contents down the side, one section per topic, and
// everything you'd test yourself on hidden behind a tap until you want it.
// Printing (or "Save as PDF") prints just the guide, with every answer shown.

function storageKey(id) {
  return `studyboy:guide-studied:${id}`;
}
function loadStudied(id) {
  try {
    return JSON.parse(window.localStorage.getItem(storageKey(id)) || '[]');
  } catch {
    return [];
  }
}
function saveStudied(id, list) {
  try {
    window.localStorage.setItem(storageKey(id), JSON.stringify(list));
  } catch {
    // private window or storage blocked: ticks just won't survive a reload
  }
}

function fileSafe(s) {
  return String(s || 'study-guide').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'study-guide';
}

function download(name, text) {
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileSafe(name)}.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Reveal({ q, a, small }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded border border-border bg-surface px-3 py-2">
      <div className={`${small ? 'text-sm' : 'text-[15px]'} text-ink`}>{q}</div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="mt-1 text-xs text-accent hover:underline print:hidden"
        aria-expanded={open}
      >
        {open ? 'Hide answer' : 'Show answer'}
      </button>
      <div className={`${open ? 'block' : 'hidden'} mt-1.5 text-sm text-muted print:block`}>{a}</div>
    </li>
  );
}

function WorkedExample({ example }) {
  const [shown, setShown] = useState(0); // steps revealed
  const total = example.steps.length;
  const all = shown >= total;
  return (
    <div className="rounded border border-border bg-bg p-3.5">
      <div className="mb-1 text-2xs uppercase text-muted">Worked example</div>
      <p className="text-[15px] text-ink">{example.prompt}</p>
      <ol className="mt-3 flex flex-col gap-1.5">
        {example.steps.map((s, i) => (
          <li
            key={i}
            className={`${i < shown ? 'flex' : 'hidden'} gap-2.5 text-sm text-ink print:flex`}
          >
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border bg-surface font-mono text-[10px] text-muted">
              {i + 1}
            </span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
      {example.answer && (
        <div className={`${all ? 'block' : 'hidden'} mt-3 border-t border-border pt-2 text-sm print:block`}>
          <span className="font-medium text-ink">Answer: </span>
          <span className="text-ink">{example.answer}</span>
        </div>
      )}
      {!all && (
        <div className="mt-3 flex gap-3 print:hidden">
          <button
            onClick={() => setShown((n) => n + 1)}
            className="rounded border border-border bg-surface px-3 py-1.5 text-xs text-ink hover:bg-bg"
          >
            {shown === 0 ? 'Show first step' : 'Next step'}
          </button>
          <button onClick={() => setShown(total)} className="text-xs text-muted hover:text-ink hover:underline">
            Show all working
          </button>
        </div>
      )}
    </div>
  );
}

function Topic({ topic, index, studied, onToggle }) {
  return (
    <section id={topicAnchor(topic.title, index)} className="scroll-mt-6 break-inside-avoid-page">
      <div className="mb-3 flex items-start gap-3">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10 font-mono text-xs text-accent">
          {index + 1}
        </span>
        <h3 className="flex-1 text-lg font-semibold leading-snug text-ink">{topic.title}</h3>
        <label className="flex shrink-0 cursor-pointer items-center gap-1.5 pt-1 text-xs text-muted print:hidden">
          <input type="checkbox" checked={studied} onChange={onToggle} className="h-3.5 w-3.5 accent-[rgb(var(--c-accent))]" />
          Studied
        </label>
      </div>

      <div className="flex flex-col gap-4 pl-10 max-sm:pl-0">
        {topic.summary && <p className="text-[15px] leading-relaxed text-ink">{topic.summary}</p>}

        {topic.key_points.length > 0 && (
          <ul className="flex list-disc flex-col gap-1 pl-5 text-[15px] leading-relaxed text-ink">
            {topic.key_points.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        )}

        {topic.key_terms.length > 0 && (
          <div>
            <div className="mb-1.5 text-2xs uppercase text-muted">Key terms</div>
            <dl className="divide-y divide-border rounded border border-border bg-surface">
              {topic.key_terms.map((k, i) => (
                <div key={i} className="grid gap-0.5 px-3 py-2 sm:grid-cols-[minmax(8rem,30%)_1fr] sm:gap-3">
                  <dt className="text-sm font-medium text-ink">{k.term}</dt>
                  <dd className="text-sm text-muted">{k.definition}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {topic.formulas.length > 0 && (
          <div>
            <div className="mb-1.5 text-2xs uppercase text-muted">Formulas</div>
            <ul className="flex flex-col gap-2">
              {topic.formulas.map((f, i) => (
                <li key={i} className="rounded border border-border bg-surface px-3 py-2">
                  {f.name && <div className="text-xs text-muted">{f.name}</div>}
                  <div className="font-mono text-base text-ink">{f.expression}</div>
                  {f.meaning && <div className="mt-0.5 text-sm text-muted">{f.meaning}</div>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {topic.tables.map((tb, ti) => (
          <div key={ti} className="overflow-x-auto">
            {tb.title && <div className="mb-1.5 text-2xs uppercase text-muted">{tb.title}</div>}
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  {tb.columns.map((c, i) => (
                    <th key={i} className="border border-border bg-bg px-2.5 py-1.5 text-left font-medium text-ink">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tb.rows.map((r, ri) => (
                  <tr key={ri}>
                    {r.map((c, ci) => (
                      <td key={ci} className="border border-border px-2.5 py-1.5 align-top text-ink">
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        {topic.example && <WorkedExample example={topic.example} />}

        {topic.mistakes.length > 0 && (
          <div className="rounded border border-warn/30 bg-warn/5 px-3.5 py-2.5">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-warn">
              <AlertTriangle size={13} /> Common mistakes
            </div>
            <ul className="flex list-disc flex-col gap-0.5 pl-5 text-sm text-ink">
              {topic.mistakes.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </div>
        )}

        {topic.memory_tip && (
          <div className="flex gap-2 rounded border border-accent/30 bg-accent/5 px-3.5 py-2.5 text-sm text-ink">
            <Lightbulb size={15} className="mt-0.5 shrink-0 text-accent" />
            <span>{topic.memory_tip}</span>
          </div>
        )}

        {topic.check.length > 0 && (
          <div>
            <div className="mb-1.5 text-2xs uppercase text-muted">Check yourself</div>
            <ul className="flex flex-col gap-2">
              {topic.check.map((c, i) => (
                <Reveal key={i} q={c.q} a={c.a} small />
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

function RecallTest({ items, subject, onRecorded }) {
  const [open, setOpen] = useState({});
  const [marks, setMarks] = useState({}); // i -> true (got it) | false (missed)
  const [recorded, setRecorded] = useState(false);
  const done = Object.keys(marks).length;
  const right = Object.values(marks).filter(Boolean).length;

  useEffect(() => {
    if (recorded || done === 0 || done < items.length) return;
    setRecorded(true);
    recordAttempts(
      items.map((it, i) => ({
        subject,
        topic: it.topic || null,
        mode: 'flashcards',
        correct: !!marks[i],
        question: it.q,
        kind: 'card',
      })),
    ).then((ok) => ok && onRecorded?.());
  }, [done, items, marks, recorded, subject, onRecorded]);

  function reset() {
    setOpen({});
    setMarks({});
    setRecorded(false);
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3 print:hidden">
        <p className="text-sm text-muted">Answer each one in your head, then reveal and mark yourself honestly.</p>
        {done > 0 && (
          <span className="shrink-0 font-mono text-sm text-ink">
            {right}/{done}
          </span>
        )}
      </div>
      <ol className="flex flex-col gap-2">
        {items.map((it, i) => {
          const mark = marks[i];
          return (
            <li
              key={i}
              className={`rounded border px-3 py-2.5 ${
                mark === true ? 'border-good/40 bg-good/5' : mark === false ? 'border-bad/40 bg-bad/5' : 'border-border bg-surface'
              }`}
            >
              <div className="flex gap-2.5">
                <span className="mt-0.5 font-mono text-xs text-muted">{i + 1}.</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] text-ink">{it.q}</div>
                  <div className={`${open[i] ? 'block' : 'hidden'} mt-1.5 text-sm text-muted print:block`}>{it.a}</div>
                  {it.topic && <div className="mt-1 text-2xs text-faint">{it.topic}</div>}
                </div>
              </div>
              <div className="mt-2 flex gap-2 pl-6 print:hidden">
                {!open[i] ? (
                  <button
                    onClick={() => setOpen((o) => ({ ...o, [i]: true }))}
                    className="rounded border border-border px-3 py-1 text-xs text-ink hover:bg-bg"
                  >
                    Reveal
                  </button>
                ) : mark === undefined ? (
                  <>
                    <button
                      onClick={() => setMarks((m) => ({ ...m, [i]: true }))}
                      className="rounded border border-good/50 px-3 py-1 text-xs text-good hover:bg-good/5"
                    >
                      Got it
                    </button>
                    <button
                      onClick={() => setMarks((m) => ({ ...m, [i]: false }))}
                      className="rounded border border-bad/40 px-3 py-1 text-xs text-bad hover:bg-bad/5"
                    >
                      Missed it
                    </button>
                  </>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
      {done === items.length && items.length > 0 && (
        <div className="mt-3 flex items-center justify-between rounded border border-border bg-bg px-3 py-2.5 print:hidden">
          <span className="text-sm text-ink">
            {right === items.length ? 'Every one. Nice.' : `${right} of ${items.length}. The missed ones are worth another read.`}
          </span>
          <button onClick={reset} className="text-xs text-accent hover:underline">
            Go again
          </button>
        </div>
      )}
    </div>
  );
}

export default function StudyGuide({ output, subject, title, guideId, onSmartStudy, onAttemptsRecorded }) {
  const guide = output?.guide || null;
  const id = guideId || (guide ? `${subject}:${guide.title}` : `${subject}:${title}`);
  const [studied, setStudied] = useState([]);
  const [copied, setCopied] = useState(false);
  const [deckMsg, setDeckMsg] = useState('');

  useEffect(() => {
    setStudied(loadStudied(id));
  }, [id]);

  const markdown = useMemo(
    () => (guide ? guideToMarkdown(guide, { subject }) : output?.text || ''),
    [guide, output, subject],
  );
  const stats = useMemo(() => (guide ? guideStats(guide) : null), [guide]);
  const terms = useMemo(() => (guide ? glossary(guide) : []), [guide]);
  const name = guide?.title || title || 'Study guide';

  function toggle(i) {
    setStudied((s) => {
      const next = s.includes(i) ? s.filter((x) => x !== i) : [...s, i];
      saveStudied(id, next);
      return next;
    });
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  async function toDeck() {
    const cards = guideCards(guide);
    setDeckMsg('Adding…');
    const res = await addCards(subject, cards, 'study_guide');
    if (res.ok) setDeckMsg(res.added ? `Added ${res.added} to your review deck` : 'Already in your review deck');
    else if (res.unavailable) setDeckMsg('The review deck needs pending-sql/006 run first');
    else setDeckMsg("Couldn't add them");
  }

  const actions = (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <button onClick={copy} className="flex items-center gap-1.5 rounded border border-border px-2.5 py-1.5 text-xs text-ink hover:bg-bg">
        {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy'}
      </button>
      <button
        onClick={() => download(name, markdown)}
        className="flex items-center gap-1.5 rounded border border-border px-2.5 py-1.5 text-xs text-ink hover:bg-bg"
      >
        <Download size={13} /> Download
      </button>
      <button
        onClick={() => window.print()}
        className="flex items-center gap-1.5 rounded border border-border px-2.5 py-1.5 text-xs text-ink hover:bg-bg"
      >
        <Printer size={13} /> Print / PDF
      </button>
      {guide && guideCards(guide).length > 0 && (
        <button onClick={toDeck} className="flex items-center gap-1.5 rounded border border-border px-2.5 py-1.5 text-xs text-ink hover:bg-bg">
          <Layers size={13} /> Add questions to review deck
        </button>
      )}
      {onSmartStudy && (
        <button
          onClick={onSmartStudy}
          className="flex items-center gap-1.5 rounded bg-accent px-2.5 py-1.5 text-xs font-medium text-white"
        >
          <Sparkles size={13} /> Smart Study this
        </button>
      )}
      {deckMsg && <span className="text-xs text-muted">{deckMsg}</span>}
    </div>
  );

  // Guides made before the structured format: show the markdown properly.
  if (!guide) {
    return (
      <article className="print-area">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold text-ink">{name}</h2>
          {actions}
        </div>
        <Markdown text={output?.text || ''} />
      </article>
    );
  }

  const progress = guide.topics.length ? Math.round((studied.length / guide.topics.length) * 100) : 0;
  const sections = [
    guide.examinable.length && { id: 'examinable', label: "What's examinable" },
    ...guide.topics.map((t, i) => ({ id: topicAnchor(t.title, i), label: t.title, topic: i })),
    guide.connections.length && { id: 'connections', label: 'How it connects' },
    guide.exam_tips.length && { id: 'exam-tips', label: 'Exam tips' },
    guide.gaps.length && { id: 'gaps', label: 'Check with your teacher' },
    guide.recall.length && { id: 'recall', label: 'Quick recall' },
    terms.length && { id: 'glossary', label: 'Glossary' },
  ].filter(Boolean);

  return (
    <article className="print-area">
      <header className="mb-6 rounded border border-border bg-surface p-5 print:border-0 print:p-0">
        <div className="mb-1 flex items-center gap-1.5 text-xs text-muted">
          <BookOpen size={13} /> Study guide{subject ? ` · ${subject}` : ''}
        </div>
        <h2 className="text-2xl font-semibold tracking-tight text-ink">{guide.title}</h2>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
          <span>{stats.topics} topics</span>
          <span>~{stats.minutes} min read</span>
          {stats.terms > 0 && <span>{stats.terms} key terms</span>}
          {stats.questions > 0 && <span>{stats.questions} questions to test yourself</span>}
        </div>
        {guide.overview && <p className="mt-3 text-[15px] leading-relaxed text-ink">{guide.overview}</p>}
        {output.truncated && (
          <p className="mt-3 text-xs text-warn print:hidden">
            Your notes were long enough that the guide hit its length limit, so the last part may be missing. Split
            the notes into two and make a guide for each to get everything.
          </p>
        )}
        <div className="mt-4">{actions}</div>
        <div className="mt-4 flex items-center gap-3 print:hidden">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg">
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${progress}%` }} />
          </div>
          <span className="shrink-0 text-xs text-muted">
            {studied.length}/{guide.topics.length} topics studied
          </span>
        </div>
      </header>

      <div className="lg:grid lg:grid-cols-[13rem_1fr] lg:gap-8 print:block">
        <nav className="mb-6 lg:mb-0 print:hidden" aria-label="Guide contents">
          <div className="lg:sticky lg:top-4">
            <div className="mb-2 text-2xs uppercase text-muted">Contents</div>
            <ol className="flex gap-1.5 overflow-x-auto pb-1 lg:flex-col lg:gap-0.5 lg:overflow-visible">
              {sections.map((s) => (
                <li key={s.id} className="shrink-0">
                  <a
                    href={`#${s.id}`}
                    className="flex items-center gap-2 rounded border border-border px-2 py-1 text-xs text-muted hover:bg-bg hover:text-ink lg:border-0 lg:py-1.5"
                  >
                    {s.topic != null ? (
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] ${
                          studied.includes(s.topic) ? 'bg-accent text-white' : 'border border-border font-mono'
                        }`}
                      >
                        {studied.includes(s.topic) ? <Check size={10} /> : s.topic + 1}
                      </span>
                    ) : (
                      <span className="w-4 shrink-0 text-center text-faint">·</span>
                    )}
                    <span className="truncate lg:whitespace-normal">{s.label}</span>
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </nav>

        <div className="flex min-w-0 flex-col gap-10">
          {guide.examinable.length > 0 && (
            <section id="examinable" className="scroll-mt-6">
              <h3 className="mb-2 text-lg font-semibold text-ink">What&apos;s examinable</h3>
              <ul className="flex flex-col gap-1.5">
                {guide.examinable.map((e, i) => (
                  <li key={i} className="flex gap-2 text-[15px] text-ink">
                    <Check size={15} className="mt-1 shrink-0 text-accent" />
                    <span>{e}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {guide.topics.map((t, i) => (
            <Topic key={i} topic={t} index={i} studied={studied.includes(i)} onToggle={() => toggle(i)} />
          ))}

          {guide.connections.length > 0 && (
            <section id="connections" className="scroll-mt-6">
              <h3 className="mb-2 text-lg font-semibold text-ink">How it connects</h3>
              <ul className="flex list-disc flex-col gap-1 pl-5 text-[15px] text-ink">
                {guide.connections.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </section>
          )}

          {guide.exam_tips.length > 0 && (
            <section id="exam-tips" className="scroll-mt-6">
              <h3 className="mb-2 text-lg font-semibold text-ink">Exam tips</h3>
              <ul className="flex list-disc flex-col gap-1 pl-5 text-[15px] text-ink">
                {guide.exam_tips.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </section>
          )}

          {guide.gaps.length > 0 && (
            <section id="gaps" className="scroll-mt-6">
              <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold text-ink">
                <HelpCircle size={17} className="text-muted" /> Check with your teacher
              </h3>
              <p className="mb-2 text-sm text-muted">Your notes mention these but don&apos;t explain them enough to revise from.</p>
              <ul className="flex list-disc flex-col gap-1 pl-5 text-[15px] text-ink">
                {guide.gaps.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </section>
          )}

          {guide.recall.length > 0 && (
            <section id="recall" className="scroll-mt-6">
              <h3 className="mb-2 text-lg font-semibold text-ink">Quick recall</h3>
              <RecallTest items={guide.recall} subject={subject} onRecorded={onAttemptsRecorded} />
            </section>
          )}

          {terms.length > 0 && (
            <section id="glossary" className="scroll-mt-6">
              <h3 className="mb-2 text-lg font-semibold text-ink">Glossary</h3>
              <dl className="divide-y divide-border rounded border border-border bg-surface">
                {terms.map((k) => (
                  <div key={k.term} className="grid gap-0.5 px-3 py-2 sm:grid-cols-[minmax(8rem,30%)_1fr] sm:gap-3">
                    <dt className="text-sm font-medium text-ink">{k.term}</dt>
                    <dd className="text-sm text-muted">{k.definition}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
        </div>
      </div>
    </article>
  );
}
