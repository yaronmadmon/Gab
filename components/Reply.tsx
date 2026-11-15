import { Fragment } from 'react';

// A very small reader for the coach's replies: paragraphs, "- " lists and **bold**.
// Anything else shows as plain text; nothing is ever treated as HTML.
function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>,
  );
}

export function Reply({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) blocks.push(<ul key={blocks.length}>{list.map((l, i) => <li key={i}>{inline(l)}</li>)}</ul>);
    list = [];
  };
  for (const line of text.split('\n')) {
    const item = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (item) { list.push(item[1]); continue; }
    flush();
    const clean = line.replace(/^#+\s*/, '').trim();
    if (clean) blocks.push(<p key={blocks.length}>{inline(clean)}</p>);
  }
  flush();
  return <>{blocks}</>;
}
