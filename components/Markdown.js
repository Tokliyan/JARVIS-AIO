// A small markdown renderer for Studyboy's text outputs (past papers and older
// study guides). Builds React elements directly, never HTML strings, so nothing
// in the text can inject markup. Handles what Claude actually writes: headings,
// paragraphs, bullet and numbered lists, tables, code blocks, rules, and
// **bold** / *italic* / `code` inline.

import { parseBlocks } from '@/lib/markdownBlocks';

function inline(text, keyBase = 'i') {
  const out = [];
  const re = /(\*\*([^*]+)\*\*|`([^`]+)`|\*([^*\s][^*]*?)\*|(?<!\w)_([^_\s][^_]*?)_(?!\w))/g;
  let last = 0;
  let m;
  let n = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${keyBase}-${n++}`;
    if (m[2] != null) out.push(<strong key={k} className="font-semibold text-ink">{m[2]}</strong>);
    else if (m[3] != null)
      out.push(
        <code key={k} className="rounded bg-bg px-1 py-0.5 font-mono text-[0.85em]">
          {m[3]}
        </code>,
      );
    else out.push(<em key={k}>{m[4] ?? m[5]}</em>);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const HEADING = {
  1: 'mt-2 text-xl font-semibold text-ink',
  2: 'mt-6 border-b border-border pb-1 text-lg font-semibold text-ink',
  3: 'mt-5 text-base font-semibold text-ink',
  4: 'mt-4 text-sm font-semibold text-ink',
};

export default function Markdown({ text, className = '' }) {
  const blocks = parseBlocks(text);
  return (
    <div className={`flex flex-col gap-3 text-[15px] leading-relaxed text-ink ${className}`}>
      {blocks.map((b, i) => {
        const k = `b${i}`;
        switch (b.type) {
          case 'heading': {
            const Tag = `h${Math.min(b.level + 1, 6)}`;
            return (
              <Tag key={k} className={HEADING[b.level] || HEADING[4]}>
                {inline(b.text, k)}
              </Tag>
            );
          }
          case 'rule':
            return <hr key={k} className="my-2 border-border" />;
          case 'code':
            return (
              <pre key={k} className="overflow-auto rounded border border-border bg-bg p-3 font-mono text-xs">
                {b.text}
              </pre>
            );
          case 'quote':
            return (
              <blockquote key={k} className="border-l-2 border-accent/50 pl-3 text-muted">
                {inline(b.text, k)}
              </blockquote>
            );
          case 'table':
            return (
              <div key={k} className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      {b.head.map((c, j) => (
                        <th key={j} className="border border-border bg-bg px-2.5 py-1.5 text-left font-medium">
                          {inline(c, `${k}h${j}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((r, ri) => (
                      <tr key={ri}>
                        {b.head.map((_, j) => (
                          <td key={j} className="border border-border px-2.5 py-1.5 align-top">
                            {inline(r[j] || '', `${k}r${ri}c${j}`)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case 'ul':
          case 'ol': {
            const List = b.type;
            return (
              <List key={k} className={`${b.type === 'ol' ? 'list-decimal' : 'list-disc'} flex flex-col gap-1 pl-5`}>
                {b.items.map((it, j) => (
                  <li key={j}>
                    {inline(it.text, `${k}l${j}`)}
                    {it.sub.length > 0 && (
                      <ul className="mt-1 list-[circle] pl-5 text-muted">
                        {it.sub.map((s, si) => (
                          <li key={si}>{inline(s, `${k}l${j}s${si}`)}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </List>
            );
          }
          default:
            return <p key={k}>{inline(b.text, k)}</p>;
        }
      })}
    </div>
  );
}
