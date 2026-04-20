'use client';

import { useEffect, useRef, useState } from 'react';
import type { SlideMeta } from '@/slides/types';

type Props = { slides: SlideMeta[]; onClose: () => void };

function findMatches(q: string, slides: SlideMeta[]) {
  const terms = q.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  if (!terms.length) return [];
  return slides
    .map((s) => {
      const hay = `${s.title} ${s.chapter} ${s.notes}`.toLowerCase();
      const hits = terms.reduce((n, t) => n + (hay.includes(t) ? 1 : 0), 0);
      return { s, hits };
    })
    .filter((x) => x.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 4);
}

function buildContext(slides: SlideMeta[]): string {
  return slides
    .map((s) => `## ${String(s.number).padStart(2, '0')} · ${s.chapter} · ${s.title}\n${s.notes}`)
    .join('\n\n');
}

export default function AskDeck({ slides, onClose }: Props) {
  const [q, setQ] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [source, setSource] = useState<'offline' | 'openrouter' | null>(null);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);

  const matches = findMatches(q, slides);

  const submit = async () => {
    if (!q.trim()) return;
    setLoading(true);
    setAnswer(null);
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, context: buildContext(slides) }),
      });
      if (res.status === 204) {
        setSource('offline');
      } else if (res.ok) {
        const json = await res.json();
        setAnswer(json.answer || '(empty answer)');
        setSource('openrouter');
      } else {
        setSource('offline');
      }
    } catch {
      setSource('offline');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="absolute inset-0 bg-bg/85 z-[70] flex items-start justify-center pt-20">
      <div className="dialog-box p-5 w-[760px] max-w-[92vw]">
        <span className="pip-bl" /><span className="pip-br" />
        <div className="flex items-center justify-between mb-3">
          <span className="font-pixel text-xs text-cyan">PREGUNTALE A LA DECK</span>
          <button className="btn-pixel" onClick={onClose}>ESC</button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <input
            ref={ref}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ej: ¿por qué dos runtimes y no uno?"
            className="w-full bg-dialog2 border-2 border-cream text-cream font-mono text-lg p-3 focus-ring"
          />
          <div className="flex justify-end mt-2">
            <button type="submit" className="btn-pixel" disabled={loading}>
              {loading ? '…pensando' : 'PREGUNTAR ↵'}
            </button>
          </div>
        </form>

        {answer && (
          <div className="mt-4 dialog-box p-4 tint-cyan">
            <span className="pip-bl" /><span className="pip-br" />
            <div className="font-pixel text-[10px] mb-2" style={{ color: 'var(--tint)' }}>
              RESPUESTA · {source === 'openrouter' ? 'openrouter' : 'deck-local'}
            </div>
            <div className="text-[15px] whitespace-pre-wrap leading-relaxed">{answer}</div>
          </div>
        )}

        <div className="mt-4 space-y-2 max-h-[48vh] overflow-auto panel-scroll">
          <div className="font-pixel text-[11px] opacity-70">
            {source === 'offline' ? 'sin server key — coincidencias offline:' : 'diapos relacionadas'}
          </div>
          {matches.length === 0 && q && (
            <div className="opacity-70 font-pixel text-xs">no hay diapos que coincidan.</div>
          )}
          {matches.map(({ s, hits }) => (
            <a
              key={s.id}
              href={`#slide-${String(s.number).padStart(2, '0')}`}
              onClick={onClose}
              className="block dialog-box p-3 hover:translate-y-[-1px] transition-transform"
            >
              <span className="pip-bl" /><span className="pip-br" />
              <div className="flex items-center justify-between text-[11px] font-pixel opacity-80">
                <span>{String(s.number).padStart(2, '0')} · {s.chapter}</span>
                <span>{hits}×</span>
              </div>
              <div className="font-pixel text-sm mt-1">{s.title}</div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
