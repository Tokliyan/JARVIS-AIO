import { useEffect, useRef, useState } from 'react';

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
const SCOPE = 'https://www.googleapis.com/auth/drive.readonly';

// Google Docs/Sheets/Slides can't be downloaded directly — they have to be
// exported to a real file format first.
const GOOGLE_EXPORTS = {
  'application/vnd.google-apps.document': 'text/plain',
  'application/vnd.google-apps.presentation': 'text/plain',
  'application/vnd.google-apps.spreadsheet': 'text/csv',
};

function loadScript(src, id) {
  return new Promise((resolve, reject) => {
    if (document.getElementById(id)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.id = id;
    s.async = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`Couldn't load ${src}`));
    document.body.appendChild(s);
  });
}

export default function DrivePicker({ onText, onError, disabled }) {
  const [ready, setReady] = useState(false);
  const [working, setWorking] = useState(false);
  const tokenClient = useRef(null);
  const accessToken = useRef(null);

  useEffect(() => {
    if (!CLIENT_ID || !API_KEY) return;
    let cancelled = false;

    (async () => {
      try {
        await loadScript('https://accounts.google.com/gsi/client', 'gsi-client');
        await loadScript('https://apis.google.com/js/api.js', 'gapi-client');
        await new Promise((resolve) => window.gapi.load('picker', resolve));
        if (cancelled) return;

        tokenClient.current = window.google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPE,
          callback: (resp) => {
            if (resp.error) {
              setWorking(false);
              onError?.('Google sign-in was cancelled or failed.');
              return;
            }
            accessToken.current = resp.access_token;
            openPicker();
          },
        });
        setReady(true);
      } catch (err) {
        onError?.(err.message);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function start() {
    if (!ready) return;
    setWorking(true);
    if (accessToken.current) openPicker();
    else tokenClient.current.requestAccessToken({ prompt: '' });
  }

  function openPicker() {
    const view = new window.google.picker.DocsView(window.google.picker.ViewId.DOCS)
      .setIncludeFolders(true)
      .setSelectFolderEnabled(false);

    const picker = new window.google.picker.PickerBuilder()
      .addView(view)
      .addView(new window.google.picker.DocsUploadView())
      .setOAuthToken(accessToken.current)
      .setDeveloperKey(API_KEY)
      .setCallback(handlePick)
      .build();

    picker.setVisible(true);
  }

  async function handlePick(data) {
    const action = data[window.google.picker.Response.ACTION];

    if (action === window.google.picker.Action.CANCEL) {
      setWorking(false);
      return;
    }
    if (action !== window.google.picker.Action.PICKED) return;

    const file = data[window.google.picker.Response.DOCUMENTS][0];
    if (!file) return setWorking(false);

    try {
      const mime = file[window.google.picker.Document.MIME_TYPE];
      const id = file[window.google.picker.Document.ID];
      const name = file[window.google.picker.Document.NAME];
      const exportAs = GOOGLE_EXPORTS[mime];

      const url = exportAs
        ? `https://www.googleapis.com/drive/v3/files/${id}/export?mimeType=${encodeURIComponent(exportAs)}`
        : `https://www.googleapis.com/drive/v3/files/${id}?alt=media`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken.current}` },
      });

      if (!res.ok) throw new Error(`Drive returned ${res.status}. Try a different file.`);

      // Text-ish content comes back usable as-is. Anything else (PDFs, images)
      // goes through the same vision extraction the upload button uses.
      if (exportAs || mime.startsWith('text/')) {
        onText(await res.text(), name);
      } else if (mime === 'application/pdf' || mime.startsWith('image/')) {
        const buf = await res.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(buf).reduce((acc, b) => acc + String.fromCharCode(b), ''),
        );
        const extract = await fetch('/api/studyboy/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64, mediaType: mime }),
        });
        const out = await extract.json();
        if (!extract.ok) throw new Error(out.error || 'Could not read that file.');
        onText(out.text, name);
      } else {
        throw new Error(`Can't read ${mime} files yet — try a Doc, PDF, or image.`);
      }
    } catch (err) {
      onError?.(err.message);
    } finally {
      setWorking(false);
    }
  }

  if (!CLIENT_ID || !API_KEY) return null;

  return (
    <button
      onClick={start}
      disabled={!ready || working || disabled}
      className="rounded border border-border px-3 py-1.5 text-sm text-ink hover:bg-bg disabled:opacity-50"
    >
      {working ? 'Opening Drive…' : 'Google Drive'}
    </button>
  );
}
