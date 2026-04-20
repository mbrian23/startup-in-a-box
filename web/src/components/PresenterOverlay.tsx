'use client';

import { useEffect, useState } from 'react';
import type { SlideMeta } from '@/slides/types';

type Props = {
  slide: SlideMeta;
  index: number;
  total: number;
  startedAt: number;
  onClose: () => void;
};

function fmt(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

export default function PresenterOverlay({ slide, index, total, startedAt, onClose }: Props) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="absolute top-4 right-4 w-[440px] max-h-[80vh] dialog-box p-4 font-mono text-[14px] text-cream z-50 panel-scroll overflow-auto">
      <span className="pip-bl" />
      <span className="pip-br" />
      <div className="flex items-center justify-between mb-2">
        <span className={`font-pixel text-[11px] tint-${slide.tint}`}>
          <span className="inline-block w-2 h-2 mr-2" style={{ background: 'var(--tint)' }} />
          PRESENTADOR · {slide.chapter.toUpperCase()}
        </span>
        <button className="btn-pixel" onClick={onClose} aria-label="close presenter">
          ESC
        </button>
      </div>
      <div className="font-pixel text-[12px] opacity-80 mb-3 flex gap-4">
        <span>
          diapo {String(index + 1).padStart(2, '0')}/{total}
        </span>
        <span>transcurrido {fmt(now - startedAt)}</span>
      </div>
      <div className="text-cream/95 whitespace-pre-wrap leading-relaxed">{slide.notes}</div>
    </div>
  );
}
