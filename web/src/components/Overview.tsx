'use client';

import type { SlideMeta } from '@/slides/types';

type Props = {
  slides: SlideMeta[];
  currentIndex: number;
  onPick: (i: number) => void;
  onClose: () => void;
};

export default function Overview({ slides, currentIndex, onPick, onClose }: Props) {
  return (
    <div className="absolute inset-0 bg-bg/95 z-[60] p-8 overflow-auto panel-scroll">
      <div className="flex items-center justify-between mb-6">
        <div className="font-pixel text-sm text-cream">VISTA · {slides.length} DIAPOS</div>
        <button className="btn-pixel" onClick={onClose}>
          ESC
        </button>
      </div>
      <div className="grid grid-cols-6 gap-4">
        {slides.map((s, i) => (
          <button
            key={s.id}
            onClick={() => onPick(i)}
            className={`text-left dialog-box p-3 focus-ring transition-transform hover:translate-y-[-2px] tint-${s.tint} ${
              i === currentIndex ? 'ring-2 ring-gold' : ''
            }`}
          >
            <span className="pip-bl" />
            <span className="pip-br" />
            <div className="flex items-center justify-between mb-1">
              <span className="font-pixel text-[10px] opacity-70">
                {String(s.number).padStart(2, '0')}
              </span>
              <span className="w-2 h-2" style={{ background: 'var(--tint)' }} />
            </div>
            <div className="font-pixel text-[10px] leading-tight text-cream min-h-[28px]">
              {s.title}
            </div>
            <div className="mt-2 text-[10px] opacity-60 font-pixel">{s.chapter}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
