import { useState } from 'react';
import SourceMaterial from '@/components/SourceMaterial';
import Generator from '@/components/Generator';

export default function StudyboyPage() {
  const [subject, setSubject] = useState('');
  const [sourceText, setSourceText] = useState('');

  return (
    <div>
      <h1 className="mb-1 text-lg font-medium text-ink">Studyboy</h1>
      <p className="mb-6 text-xs text-muted">
        Practice papers, revision guides, and study plans built from your own course material.
      </p>

      <div className="flex flex-col gap-4">
        <SourceMaterial
          subject={subject}
          setSubject={setSubject}
          sourceText={sourceText}
          setSourceText={setSourceText}
        />
        <Generator subject={subject} sourceText={sourceText} />
      </div>
    </div>
  );
}
