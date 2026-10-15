import { useState } from 'react';
import { authedFetch } from '@/lib/authedFetch';

// Turning a picked file into text, shared by the new-note editor and the
// "make a study guide" box. Text files are read in the browser; Word and
// PowerPoint are unzipped on the server; PDFs and photos go to Claude to read.

const TEXT_TYPES = ['text/plain', 'text/markdown', 'text/csv', 'application/json'];

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });
}

export const ACCEPT = '.txt,.md,.csv,.json,.pdf,.docx,.pptx,image/*';

export default function useMaterialUpload() {
  const [reading, setReading] = useState(false);
  const [error, setError] = useState(null);

  /** Returns { text, name, source } or null (error is set). */
  async function readFile(file, source = 'device_upload') {
    if (!file) return null;
    setError(null);

    if (TEXT_TYPES.includes(file.type) || /\.(txt|md|csv|json)$/i.test(file.name)) {
      return { text: await file.text(), name: file.name, source };
    }
    if (/\.(doc|ppt)$/i.test(file.name)) {
      setError("Old .doc/.ppt files can't be read. Save as .docx/.pptx (or export a PDF) and try again.");
      return null;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('That file is over 10MB. Try a smaller one or split it up.');
      return null;
    }

    setReading(true);
    try {
      const base64 = await fileToBase64(file);
      const office = /\.(docx|pptx)$/i.test(file.name);
      const res = office
        ? await authedFetch('/api/studyboy/extract-document', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ base64, fileName: file.name }),
          })
        : await fetch('/api/studyboy/extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ base64, mediaType: file.type }),
          });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Could not read that file.');
        return null;
      }
      return { text: data.text || '', name: file.name, source };
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setReading(false);
    }
  }

  return { readFile, reading, error, setError };
}
