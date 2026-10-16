// SERVER-ONLY. Pulls plain text out of Word (.docx) and PowerPoint (.pptx)
// files so they can be used as Studyboy source material. Reads the file's own
// XML — nothing is executed and nothing is uploaded anywhere.

import JSZip from 'jszip';
import mammoth from 'mammoth';

const MAX_CHARS = 400_000;
const MAX_SLIDES = 300;

function clean(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_CHARS);
}

function decodeXml(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&');
}

export async function extractDocx(buffer) {
  const { value } = await mammoth.extractRawText({ buffer });
  return clean(value);
}

// One string per paragraph (<a:p>), skipping auto-fields such as slide numbers.
function paragraphsOf(xml) {
  const noFields = xml.replace(/<a:fld\b[\s\S]*?<\/a:fld>/g, '');
  return noFields
    .split('</a:p>')
    .map((p) => {
      const parts = [];
      const re = /<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g;
      let m;
      while ((m = re.exec(p))) parts.push(decodeXml(m[1]));
      return parts.join('').trim();
    })
    .filter(Boolean);
}

export async function extractPptx(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const numbered = (re) =>
    Object.keys(zip.files)
      .map((name) => ({ name, m: name.match(re) }))
      .filter((x) => x.m)
      .map((x) => ({ name: x.name, n: Number(x.m[1]) }))
      .sort((a, b) => a.n - b.n)
      .slice(0, MAX_SLIDES);

  const slides = numbered(/^ppt\/slides\/slide(\d+)\.xml$/);
  const notes = new Map(numbered(/^ppt\/notesSlides\/notesSlide(\d+)\.xml$/).map((x) => [x.n, x.name]));

  const out = [];
  for (const slide of slides) {
    const body = paragraphsOf(await zip.file(slide.name).async('string'));
    let block = `Slide ${slide.n}\n${body.join('\n')}`;
    // Speaker notes are often where the real explanation lives.
    const noteName = notes.get(slide.n);
    if (noteName) {
      const noteText = paragraphsOf(await zip.file(noteName).async('string'));
      if (noteText.length) block += `\nNotes: ${noteText.join(' ')}`;
    }
    if (body.length || block.includes('Notes:')) out.push(block);
  }
  return clean(out.join('\n\n'));
}

/** Dispatch on file extension. Returns { text } or { error }. */
export async function extractDocument(buffer, fileName) {
  const name = String(fileName || '').toLowerCase();
  try {
    let text;
    if (name.endsWith('.docx')) text = await extractDocx(buffer);
    else if (name.endsWith('.pptx')) text = await extractPptx(buffer);
    else if (name.endsWith('.doc') || name.endsWith('.ppt')) {
      return { error: 'Old .doc/.ppt files are not supported. Save it as .docx or .pptx (or export a PDF) and try again.' };
    } else return { error: 'Only .docx and .pptx files are handled here.' };

    if (!text) {
      return { error: 'No readable text found. If the file is made of pictures, export it to PDF and upload that instead.' };
    }
    return { text };
  } catch {
    return { error: "Couldn't open that file. It may be damaged or password-protected." };
  }
}
