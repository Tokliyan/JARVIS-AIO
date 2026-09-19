import { useRef, useState } from 'react';
import SourceMaterial from '@/components/SourceMaterial';
import Generator from '@/components/Generator';
import StudyboyHistory from '@/components/StudyboyHistory';
import { SUBJECTS } from '@/lib/subjects';

const TABS = ['Create', 'History'];

export default function StudyboyPage() {
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [sourceText, setSourceText] = useState('');
  const [tab, setTab] = useState('Create');
  const [reopened, setReopened] = useState(null);
  const historyRef = useRef(null);

  function selectSubject(s) {
    setSubject(s);
    setSourceText('');
    setReopened(null);
  }

  function openFromHistory(item) {
    setReopened(item.payload);
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
          <SourceMaterial
            subject={subject}
            setSubject={setSubject}
            sourceText={sourceText}
            setSourceText={setSourceText}
          />
          <Generator
            key={reopened ? 'reopened' : subject}
            subject={subject}
            sourceText={sourceText}
            initialOutput={reopened}
            onSaved={() => historyRef.current?.reload()}
          />
        </div>
      ) : (
        <div className="animate-row-in">
          <StudyboyHistory ref={historyRef} onOpen={openFromHistory} subjectFilter={subject} />
        </div>
      )}
    </div>
  );
}
