'use client';

import { useEffect, useRef, useState } from 'react';

type Props = { max: number; onGo: (n: number) => void; onClose: () => void };

export default function GotoModal({ max, onGo, onClose }: Props) {
  const [v, setV] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);

  return (
    <div className="absolute inset-0 bg-bg/80 z-[70] flex items-center justify-center">
      <form
        className="dialog-box p-6 w-[420px]"
        onSubmit={(e) => {
          e.preventDefault();
          const n = parseInt(v, 10);
          if (!isNaN(n) && n >= 1 && n <= max) onGo(n);
        }}
      >
        <span className="pip-bl" />
        <span className="pip-br" />
        <div className="font-pixel text-xs text-gold mb-3">IR A LA DIAPOSITIVA</div>
        <input
          ref={ref}
          value={v}
          onChange={(e) => setV(e.target.value.replace(/\D/g, ''))}
          placeholder={`1-${max}`}
          className="w-full bg-dialog2 border-2 border-cream text-cream font-mono text-xl p-3 focus-ring"
        />
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" className="btn-pixel" onClick={onClose}>
            ESC
          </button>
          <button type="submit" className="btn-pixel" style={{ color: 'var(--gold)' }}>
            IR
          </button>
        </div>
      </form>
    </div>
  );
}
