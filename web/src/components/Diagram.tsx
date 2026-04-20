'use client';

import { useEffect, useRef, useState } from 'react';

type Props = { chart: string; caption?: string };

export default function Diagram({ chart, caption }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState<string | null>(null);
  const id = useRef(`m-${Math.random().toString(36).slice(2, 9)}`);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: 'base',
          themeVariables: {
            background: '#121C38',
            primaryColor: '#1C2A4C',
            primaryTextColor: '#ECDFC0',
            primaryBorderColor: '#D4A84A',
            lineColor: '#ECDFC0',
            secondaryColor: '#6BA8B8',
            tertiaryColor: '#8B6FA6',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '15px',
          },
          securityLevel: 'loose',
        });
        const { svg } = await mermaid.render(id.current, chart);
        if (cancelled || !ref.current) return;
        ref.current.innerHTML = svg;
        const svgEl = ref.current.querySelector('svg');
        if (svgEl) {
          // Let the SVG scale to its box via viewBox — no fixed dimensions,
          // no svg-pan-zoom (ZoomPan handles zoom at the slide level).
          svgEl.removeAttribute('width');
          svgEl.removeAttribute('height');
          svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
          (svgEl as SVGElement).style.width = '100%';
          (svgEl as SVGElement).style.height = '100%';
          (svgEl as SVGElement).style.maxHeight = '100%';
          (svgEl as SVGElement).style.display = 'block';
        }
      } catch (e) {
        setErr(String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chart]);

  return (
    <div className="dialog-box p-3 mermaid-wrap flex flex-col min-h-[60vh]">
      <span className="pip-bl" />
      <span className="pip-br" />
      {caption && <div className="font-pixel text-[11px] opacity-80 mb-2 px-1">{caption}</div>}
      {err && <div className="text-magenta text-sm p-3">{err}</div>}
      <div ref={ref} className="flex-1 min-h-0" />
    </div>
  );
}
