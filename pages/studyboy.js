import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabaseClient';
import SourceMaterial from '@/components/SourceMaterial';
import Generator from '@/components/Generator';
import StudyboyHistory from '@/components/StudyboyHistory';
import StudyResources from '@/components/StudyResources';
import WeakTopics from '@/components/WeakTopics';
import NotificationLog from '@/components/NotificationLog';
import { SUBJECTS } from '@/lib/subjects';

const TABS = ['Create', 'History', 'Notifications'];

export default function StudyboyPage() {
  const router = useRouter();
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [sourceText, setSourceText] = useState('');
  const [tab, setTab] = useState('Create');
  const [reopened, setReopened] = useState(null);
  // Bumped on every reopen so the Generator actually remounts when you open a
  // second saved output without changing subject in between.
  const [reopenKey, setReopenKey] = useState(0);
  const [attemptsKey, setAttemptsKey] = useState(0);
  const historyRef = useRef(null);

  // ?open=<id> — the command bar builds material and then sends you straight to
  // it, rather than dropping you on an empty page.
  useEffect(() => {
    const id = router.query.open;
    if (!id) return;
    (async () => {
      const { data } = await supabase
        .from('aio_studyboy_outputs')
        .select('subject, payload')
        .eq('id', id)
        .maybeSingle();
      if (data?.payload) {
        setReopened(data.payload);
        setReopenKey((n) => n + 1);
        if (data.subject) setSubject(data.subject);
        setTab('Create');
      }
      // Drop the param so a refresh doesn't keep reopening the same thing.
      router.replace('/studyboy', undefined, { shallow: true, scroll: false });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.query.open]);

  function selectSubject(s) {
    setSubject(s);
    setSourceText('');
    setReopened(null);
  }

  function openFromHistory(item) {
    setReopened(item.payload);
    setReopenKey((n) => n + 1);
    setSubject(item.subject || SUBJECTS[0]);
    setTab('Create');
  }

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-5">
        <h1 className="text-2xl font-medium tracking-tight text-ink">Studyboy</h1>
        <p className="mt-0.5 text-sm text-muted">
          Papers, guides, cards and plans built from your own course material.
        </p>
      </header>

      {tab !== 'Notifications' && (
        <div className="mb-6 flex flex-wrap gap-1.5">
          {SUBJECTS.map((s) => (
            <button
              key={s}
              onClick={() => selectSubject(s)}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                subject === s
                  ? 'border-accent bg-accent text-white'
                  : 'border-border text-ink hover:bg-bg'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="mb-6 flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
              tab === t
                ? 'border-accent font-medium text-ink'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Create' ? (
        <div className="flex animate-row-in flex-col gap-4">
          <WeakTopics subject={subject} refreshKey={attemptsKey} />
          <StudyResources subject={subject} />
          <SourceMaterial
            subject={subject}
            setSubject={setSubject}
            sourceText={sourceText}
            setSourceText={setSourceText}
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
      ) : tab === 'History' ? (
        <div className="animate-row-in">
          <StudyboyHistory ref={historyRef} onOpen={openFromHistory} subjectFilter={subject} />
        </div>
      ) : (
        <div className="animate-row-in">
          <p className="mb-3 text-sm text-muted">
            School notifications the command bar has processed — what it captured,
            which subjects it filed it under, and what it built.
          </p>
          <NotificationLog />
        </div>
      )}
    </div>
  );
}
