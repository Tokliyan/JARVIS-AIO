import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { BookOpen, ChevronRight, FileText, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import SourceMaterial from '@/components/SourceMaterial';
import Generator from '@/components/Generator';
import StudyboyHistory from '@/components/StudyboyHistory';
import StudyResources from '@/components/StudyResources';
import WeakTopics from '@/components/WeakTopics';
import SmartStudy from '@/components/SmartStudy';
import ReviewDeck from '@/components/ReviewDeck';
import ProgressBoard from '@/components/ProgressBoard';
import NotificationLog from '@/components/NotificationLog';
import ComingUp from '@/components/ComingUp';
import MakeGuideBox from '@/components/MakeGuideBox';
import GuideProgress from '@/components/GuideProgress';
import NotesLibrary from '@/components/NotesLibrary';
import GuidesLibrary from '@/components/GuidesLibrary';
import { SUBJECTS } from '@/lib/subjects';
import { combineNotes, generateGuide, listGuides, listNotes, saveGuide, saveNote, snippet } from '@/lib/notes';

// Studyboy is laid out around your notes:
//   Home           what school has coming up, paste notes -> study guide, recent stuff
//   Notes          every note you've saved, searchable
//   Guides         every study guide, opened in the guide reader
//   Practice       Smart Study, the review deck, progress, quizzes/papers, history
//   Notifications  what the command bar captured from school (study updates first)

const TABS = ['Home', 'Notes', 'Guides', 'Practice', 'Notifications'];
const PRACTICE = ['Smart Study', 'Review', 'Progress', 'Quizzes & papers', 'History'];

function day(iso) {
  return iso ? new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : '';
}

export default function StudyboyPage() {
  const router = useRouter();
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [tab, setTab] = useState('Home');
  const [practiceTab, setPracticeTab] = useState('Smart Study');

  const [notes, setNotes] = useState([]);
  const [notesState, setNotesState] = useState({ loading: true, error: null });
  const [guides, setGuides] = useState([]);
  const [guidesLoading, setGuidesLoading] = useState(true);
  const [selectedNoteId, setSelectedNoteId] = useState(null);
  const [openGuide, setOpenGuide] = useState(null);
  const [studyOnly, setStudyOnly] = useState(true);

  // The material Smart Study and the practice tools work from.
  const [sourceText, setSourceText] = useState('');
  const [activeSource, setActiveSource] = useState(null); // { label, noteId? }

  const [making, setMaking] = useState(null); // { subject, title, startedAt, fromTab }
  const [makeError, setMakeError] = useState(null);
  const [ready, setReady] = useState(null); // a finished guide waiting to be opened

  const [reopened, setReopened] = useState(null);
  const [reopenKey, setReopenKey] = useState(0);
  const [attemptsKey, setAttemptsKey] = useState(0);
  const historyRef = useRef(null);
  const tabRef = useRef(tab);
  tabRef.current = tab;

  const refreshNotes = useCallback(async () => {
    const res = await listNotes();
    setNotes(res.notes);
    setNotesState({ loading: false, error: res.ok ? null : res.error });
    return res.notes;
  }, []);

  const refreshGuides = useCallback(async () => {
    const res = await listGuides();
    setGuides(res.guides);
    setGuidesLoading(false);
    return res.guides;
  }, []);

  useEffect(() => {
    refreshNotes();
    refreshGuides();
  }, [refreshNotes, refreshGuides]);

  // ?open=<id>: the command bar builds material and then sends you straight to it.
  useEffect(() => {
    const id = router.query.open;
    if (!id) return;
    (async () => {
      const { data } = await supabase
        .from('aio_studyboy_outputs')
        .select('id, subject, title, mode, payload, created_at')
        .eq('id', id)
        .maybeSingle();
      if (data?.payload) openOutput(data);
      router.replace('/studyboy', undefined, { shallow: true, scroll: false });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.query.open]);

  function openOutput(item) {
    if (item.subject && SUBJECTS.includes(item.subject)) setSubject(item.subject);
    if ((item.mode || item.payload?.mode) === 'study_guide') {
      setOpenGuide(item);
      setTab('Guides');
      return;
    }
    setReopened(item.payload);
    setReopenKey((n) => n + 1);
    setPracticeTab('Quizzes & papers');
    setTab('Practice');
  }

  function selectSubject(s) {
    setSubject(s);
    setSourceText('');
    setActiveSource(null);
    setReopened(null);
  }

  const notesBySubject = notes.reduce((m, n) => ({ ...m, [n.subject]: (m[n.subject] || 0) + 1 }), {});

  function loadAllNotes(subj = subject, list = notes) {
    const text = combineNotes(list, subj);
    setSourceText(text);
    const count = list.filter((n) => n.subject === subj).length;
    setActiveSource(text ? { label: `All ${count} ${subj} note${count === 1 ? '' : 's'}` } : null);
    return !!text;
  }

  function loadNote(note) {
    setSourceText(note.ocr_text || '');
    setActiveSource({ label: note.file_name || 'Untitled notes', noteId: note.id });
  }

  // Going into Practice with nothing loaded: use everything saved for the subject.
  useEffect(() => {
    if (tab === 'Practice' && !sourceText.trim() && !notesState.loading) loadAllNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, subject, notesState.loading]);

  function practise(note, which) {
    if (note.subject && SUBJECTS.includes(note.subject)) setSubject(note.subject);
    loadNote(note);
    setPracticeTab(which);
    setTab('Practice');
  }

  async function makeGuide({ subject: subj, title, text, source, noteId, depth = 'full', strictness = 'strict' }) {
    if (making) return false;
    const fromTab = tabRef.current;
    setMakeError(null);
    setReady(null);
    setMaking({ subject: subj, title, startedAt: Date.now(), fromTab });

    let docId = noteId || null;
    if (!docId) {
      const saved = await saveNote({ subject: subj, title, text, source });
      if (saved.ok) {
        docId = saved.note.id;
        refreshNotes();
      }
    }

    const res = await generateGuide({ subject: subj, text, depth, strictness, sourceDocId: docId });
    if (!res.ok) {
      setMaking(null);
      setMakeError(res.error);
      return false;
    }

    const saved = await saveGuide({ subject: subj, payload: res.payload });
    const row = saved.ok
      ? saved.guide
      : { id: null, subject: subj, title: res.payload.guide?.title || 'Study guide', payload: res.payload };
    refreshGuides();
    historyRef.current?.reload();
    setMaking(null);

    // Still where you started (or on Guides)? Open it. Otherwise don't yank
    // you away from whatever you moved on to: say it's ready instead.
    if (tabRef.current === fromTab || tabRef.current === 'Guides') {
      if (subj && SUBJECTS.includes(subj)) setSubject(subj);
      setOpenGuide(row);
      setTab('Guides');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setReady(row);
    }
    return true;
  }

  function makeFromNote(note, depth) {
    return makeGuide({
      subject: note.subject,
      title: note.file_name,
      text: note.ocr_text || '',
      noteId: note.id,
      depth,
    });
  }

  function prepare(item) {
    if (SUBJECTS.includes(item.subject)) selectSubject(item.subject);
    const latest = notes.find((n) => n.subject === item.subject);
    if (latest) {
      setSelectedNoteId(latest.id);
      setTab('Notes');
    } else {
      setTab('Home');
      setTimeout(() => document.getElementById('make-guide')?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }

  function smartStudyGuide(g) {
    const note = notes.find((n) => n.id === g.payload?.source_doc_id);
    if (g.subject && SUBJECTS.includes(g.subject)) setSubject(g.subject);
    if (note) loadNote(note);
    else {
      setSourceText(g.payload?.text || '');
      setActiveSource({ label: g.title });
    }
    setPracticeTab('Smart Study');
    setTab('Practice');
  }

  const recentGuides = guides.slice(0, 4);
  const recentNotes = notes.slice(0, 5);

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-medium tracking-tight text-ink">Studyboy</h1>
          <p className="mt-0.5 text-sm text-muted">Your notes, turned into study guides and practice.</p>
        </div>
        <button
          onClick={() => {
            setTab('Home');
            setTimeout(() => document.getElementById('make-guide')?.scrollIntoView({ behavior: 'smooth' }), 50);
          }}
          className="flex items-center gap-1.5 rounded bg-accent px-3 py-1.5 text-sm font-medium text-white"
        >
          <Sparkles size={14} /> New study guide
        </button>
      </header>

      <div className="print:hidden">
        {(making || makeError) && (
          <GuideProgress
            subject={making?.subject}
            title={making?.title}
            startedAt={making?.startedAt}
            error={makeError}
            onDismiss={() => setMakeError(null)}
          />
        )}
        {ready && (
          <div className="mb-5 flex items-center justify-between gap-3 rounded border border-good/40 bg-good/5 px-4 py-3">
            <span className="text-sm text-ink">
              Your study guide is ready: <span className="font-medium">{ready.title}</span>
            </span>
            <span className="flex shrink-0 gap-3">
              <button
                onClick={() => {
                  setOpenGuide(ready);
                  setTab('Guides');
                  setReady(null);
                }}
                className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white"
              >
                Open it
              </button>
              <button onClick={() => setReady(null)} className="text-xs text-muted hover:text-ink">
                Later
              </button>
            </span>
          </div>
        )}

        {tab !== 'Notifications' && (
          <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1">
            {SUBJECTS.map((s) => (
              <button
                key={s}
                onClick={() => selectSubject(s)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  subject === s ? 'border-accent bg-accent text-white' : 'border-border text-ink hover:bg-bg'
                }`}
              >
                {s}
                {notesBySubject[s] ? (
                  <span className={`ml-1.5 font-mono text-2xs ${subject === s ? 'text-white/80' : 'text-faint'}`}>
                    {notesBySubject[s]}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        )}

        <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-border" aria-label="Studyboy sections">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                if (t === 'Guides' && tab === 'Guides') setOpenGuide(null);
              }}
              aria-current={tab === t ? 'page' : undefined}
              className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-sm transition-colors ${
                tab === t ? 'border-accent font-medium text-ink' : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              {t}
              {t === 'Notes' && notes.length > 0 && <span className="ml-1.5 font-mono text-2xs text-faint">{notes.length}</span>}
              {t === 'Guides' && guides.length > 0 && (
                <span className="ml-1.5 font-mono text-2xs text-faint">{guides.length}</span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'Home' ? (
        <div className="flex animate-row-in flex-col gap-5">
          <ComingUp
            onPrepare={prepare}
            onOpenNotifications={() => setTab('Notifications')}
            notesBySubject={notesBySubject}
          />

          <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
            <div id="make-guide" className="scroll-mt-4">
              <MakeGuideBox subject={subject} busy={!!making} onMake={makeGuide} />
            </div>

            <div className="flex flex-col gap-5">
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-sm font-medium text-ink">Recent study guides</h2>
                  <button onClick={() => setTab('Guides')} className="flex items-center text-xs text-accent hover:underline">
                    All <ChevronRight size={12} />
                  </button>
                </div>
                {recentGuides.length === 0 ? (
                  <p className="text-sm text-muted">{guidesLoading ? 'Loading…' : 'None yet. Your first one appears here.'}</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-border rounded border border-border bg-surface">
                    {recentGuides.map((g) => (
                      <li key={g.id}>
                        <button
                          onClick={() => openOutput(g)}
                          className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-bg"
                        >
                          <BookOpen size={14} className="shrink-0 text-accent" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-ink">{g.title}</span>
                            <span className="block text-2xs text-muted">
                              {g.subject} · {day(g.created_at)}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-sm font-medium text-ink">Recent notes</h2>
                  <button onClick={() => setTab('Notes')} className="flex items-center text-xs text-accent hover:underline">
                    All <ChevronRight size={12} />
                  </button>
                </div>
                {recentNotes.length === 0 ? (
                  <p className="text-sm text-muted">{notesState.loading ? 'Loading…' : 'None yet.'}</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-border rounded border border-border bg-surface">
                    {recentNotes.map((n) => (
                      <li key={n.id}>
                        <button
                          onClick={() => {
                            if (SUBJECTS.includes(n.subject)) setSubject(n.subject);
                            setSelectedNoteId(n.id);
                            setTab('Notes');
                          }}
                          className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-bg"
                        >
                          <FileText size={14} className="shrink-0 text-faint" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-ink">{n.file_name || 'Untitled notes'}</span>
                            <span className="block truncate text-2xs text-muted">
                              {n.subject} · {snippet(n.ocr_text, 60)}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        </div>
      ) : tab === 'Notes' ? (
        <div className="animate-row-in">
          <NotesLibrary
            notes={notes}
            loading={notesState.loading}
            error={notesState.error}
            guides={guides}
            subject={subject}
            selectedId={selectedNoteId}
            onSelect={setSelectedNoteId}
            onRefresh={refreshNotes}
            making={!!making}
            onMakeGuide={makeFromNote}
            onOpenGuide={openOutput}
            onPractise={practise}
          />
        </div>
      ) : tab === 'Guides' ? (
        <div className="animate-row-in">
          <GuidesLibrary
            guides={guides}
            loading={guidesLoading}
            subject={subject}
            open={openGuide}
            onOpen={setOpenGuide}
            onClose={() => setOpenGuide(null)}
            onRefresh={refreshGuides}
            onNew={() => {
              setTab('Home');
              setTimeout(() => document.getElementById('make-guide')?.scrollIntoView({ behavior: 'smooth' }), 50);
            }}
            onSmartStudy={smartStudyGuide}
            onAttemptsRecorded={() => setAttemptsKey((n) => n + 1)}
          />
        </div>
      ) : tab === 'Practice' ? (
        <div className="animate-row-in">
          <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded border border-border bg-surface px-3 py-2 text-sm">
            <span className="text-muted">Practising from:</span>
            <span className="min-w-0 flex-1 truncate font-medium text-ink">
              {activeSource?.label || (sourceText.trim() ? 'Pasted material' : `Nothing yet, no ${subject} notes saved`)}
            </span>
            {activeSource?.noteId && notesBySubject[subject] > 1 && (
              <button onClick={() => loadAllNotes()} className="text-xs text-accent hover:underline">
                Use all {subject} notes
              </button>
            )}
            <button onClick={() => setTab('Notes')} className="text-xs text-accent hover:underline">
              Pick a note
            </button>
          </div>

          <div className="mb-5 flex gap-1 overflow-x-auto">
            {PRACTICE.map((p) => (
              <button
                key={p}
                onClick={() => setPracticeTab(p)}
                aria-pressed={practiceTab === p}
                className={`shrink-0 rounded px-3 py-1.5 text-sm transition-colors ${
                  practiceTab === p ? 'bg-ink text-bg' : 'text-muted hover:bg-bg hover:text-ink'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          {practiceTab === 'Smart Study' ? (
            <SmartStudy
              key={`${subject}:${activeSource?.label || ''}`}
              subject={subject}
              sourceText={sourceText}
              onGoCreate={() => setTab('Notes')}
              onAttemptsRecorded={() => setAttemptsKey((n) => n + 1)}
            />
          ) : practiceTab === 'Review' ? (
            <ReviewDeck subject={subject} onAttemptsRecorded={() => setAttemptsKey((n) => n + 1)} />
          ) : practiceTab === 'Progress' ? (
            <ProgressBoard
              subject={subject}
              refreshKey={attemptsKey}
              onStudyWeak={() => setPracticeTab('Smart Study')}
            />
          ) : practiceTab === 'Quizzes & papers' ? (
            <div className="flex flex-col gap-4">
              <WeakTopics subject={subject} refreshKey={attemptsKey} />
              <StudyResources subject={subject} />
              <SourceMaterial
                subject={subject}
                setSubject={setSubject}
                sourceText={sourceText}
                setSourceText={(v) => {
                  setSourceText(v);
                  setActiveSource(null);
                }}
              />
              <Generator
                key={reopened ? `reopened-${reopenKey}` : subject}
                subject={subject}
                sourceText={sourceText}
                initialOutput={reopened}
                onSaved={() => historyRef.current?.reload()}
                onAttemptsRecorded={() => setAttemptsKey((n) => n + 1)}
              />
            </div>
          ) : (
            <StudyboyHistory ref={historyRef} onOpen={openOutput} subjectFilter={subject} />
          )}
        </div>
      ) : (
        <div className="animate-row-in">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted">
              School notifications pasted into the command bar: what was captured, which subjects it went to, and
              what was made from it. Each one is also saved in Notes.
            </p>
            <label className="flex items-center gap-1.5 text-xs text-muted">
              <input
                type="checkbox"
                checked={studyOnly}
                onChange={(e) => setStudyOnly(e.target.checked)}
                className="h-3.5 w-3.5"
              />
              Study updates only
            </label>
          </div>
          <NotificationLog studyOnly={studyOnly} />
        </div>
      )}
    </div>
  );
}
