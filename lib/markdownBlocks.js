// Splits markdown text into blocks for components/Markdown.js. Pure, so it can
// be unit tested without React.

const isTableRow = (l) => /^\s*\|.*\|\s*$/.test(l);
const isDivider = (l) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l);
const cells = (l) =>
  l
    .trim()
    .replace(/^\||\|$/g, '')
    .split(/(?<!\\)\|/)
    .map((c) => c.replace(/\\\|/g, '|').trim());

export function parseBlocks(src) {
  const lines = String(src || '').replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    if (/^```/.test(line.trim())) {
      const body = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i].trim())) body.push(lines[i++]);
      i++;
      blocks.push({ type: 'code', text: body.join('\n') });
      continue;
    }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      blocks.push({ type: 'heading', level: h[1].length, text: h[2].replace(/\s+#+\s*$/, '') });
      i++;
      continue;
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      blocks.push({ type: 'rule' });
      i++;
      continue;
    }
    if (isTableRow(line) && i + 1 < lines.length && isDivider(lines[i + 1])) {
      const head = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && isTableRow(lines[i])) rows.push(cells(lines[i++]));
      blocks.push({ type: 'table', head, rows });
      continue;
    }
    const li = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
    if (li) {
      const ordered = /\d/.test(li[2]);
      const items = [];
      while (i < lines.length) {
        const m = lines[i].match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
        const nested = m && m[1].length > li[1].length + 1;
        if (m && !nested && /\d/.test(m[2]) === ordered) {
          items.push({ text: m[3], sub: [] });
          i++;
        } else if (nested || (!m && lines[i].trim() && /^\s{2,}/.test(lines[i]) && items.length)) {
          // Indented continuation or a nested list item: keep it under the last item.
          items[items.length - 1].sub.push(lines[i].trim().replace(/^([-*+]|\d+[.)])\s+/, ''));
          i++;
        } else break;
      }
      blocks.push({ type: ordered ? 'ol' : 'ul', items });
      continue;
    }
    if (/^>\s?/.test(line)) {
      const body = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) body.push(lines[i++].replace(/^>\s?/, ''));
      blocks.push({ type: 'quote', text: body.join(' ') });
      continue;
    }
    const para = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,6})\s/.test(lines[i]) &&
      !/^```/.test(lines[i].trim()) &&
      !/^\s*([-*+]|\d+[.)])\s+/.test(lines[i]) &&
      !(isTableRow(lines[i]) && i + 1 < lines.length && isDivider(lines[i + 1]))
    ) {
      para.push(lines[i++].trim());
    }
    blocks.push({ type: 'p', text: para.join(' ') });
  }
  return blocks;
}
