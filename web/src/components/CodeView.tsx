'use client';

import { useEffect, useState } from 'react';
import { loadSnapshot, findFile, type SnapshotFile } from '@/lib/snapshot';

type Props = {
  path: string;
  lines?: [number, number];
  language?: string;
  caption?: string;
  maxLines?: number;
};

export default function CodeView({ path, lines, language, caption, maxLines = 20 }: Props) {
  const [html, setHtml] = useState<string>('');
  const [file, setFile] = useState<SnapshotFile | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await loadSnapshot();
        const f = findFile(snap, path);
        if (!f) {
          setErr(`not in snapshot: ${path}`);
          return;
        }
        setFile(f);
        const shiki = await import('shiki');
        const { chronoTheme } = await import('@/lib/shiki-theme');
        const highlighter = await shiki.createHighlighter({
          themes: [chronoTheme as never],
          langs: ['python', 'typescript', 'tsx', 'json', 'yaml', 'markdown', 'bash'],
        });
        const src = sliceByLines(f.content, lines);
        const h = highlighter.codeToHtml(src, {
          lang: (language || f.language) as never,
          theme: 'chrono-zeal',
        });
        if (!cancelled) setHtml(h);
      } catch (e) {
        setErr(String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [path, lines, language]);

  return (
    <div className="dialog-box p-0 overflow-hidden">
      <span className="pip-bl" />
      <span className="pip-br" />
      <header className="flex items-center justify-between px-4 py-2 border-b-2 border-greyline bg-dialog2/70">
        <span className="font-pixel text-[11px] opacity-80">{path}{lines ? ` · lines ${lines[0]}–${lines[1]}` : ''}</span>
        <div className="flex items-center gap-2">
          {caption && <span className="text-[12px] opacity-70">{caption}</span>}
          {file && (
            <button className="btn-pixel !py-1 !px-2 !text-[10px]" onClick={() => setExpanded((v) => !v)}>
              {expanded ? 'COLLAPSE' : 'EXPAND ↗'}
            </button>
          )}
        </div>
      </header>
      <div
        className={`panel-scroll overflow-auto text-[14px] leading-[1.6] ${expanded ? 'max-h-[72vh]' : ''}`}
        style={{ maxHeight: expanded ? undefined : `${maxLines * 1.6 * 14 + 24}px` }}
      >
        {err && <div className="p-4 text-magenta text-sm">{err}</div>}
        {!err && !html && <div className="p-4 text-cream/60 text-sm">loading…</div>}
        {html && <div dangerouslySetInnerHTML={{ __html: html }} />}
      </div>
    </div>
  );
}

function sliceByLines(content: string, lines?: [number, number]): string {
  if (!lines) return content;
  const all = content.split('\n');
  const [a, b] = lines;
  return all.slice(Math.max(0, a - 1), Math.min(all.length, b)).join('\n');
}
