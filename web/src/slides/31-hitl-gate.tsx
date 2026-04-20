'use client';

import { useEffect, useState } from 'react';
import Slide from '@/components/Slide';
import type { SlideProps } from './types';

export const meta = {
  id: '31-hitl-gate',
  number: 31,
  chapter: 'Etapa 3 · Final Level',
  title: 'Gate HITL — 6 segundos para decir que no',
  tint: 'gold' as const,
  notes: `Línea cruda: "Seis segundos. Cuando la fábrica está por empezar a tocar archivos, sale una cuenta regresiva y un botón de cancelar. Si no apretás nada, auto-approve."
Punchline no escrito: "Seis segundos es suficiente para decir 'espera'. No es suficiente para distraerse."
Pregunta probable: "¿Por qué seis y no dos?" → "Probamos tres. La gente no alcanzaba. Probamos diez. La gente se distraía. Seis es el sweet spot."`,
};

export default function Slide31({}: SlideProps) {
  const [active, setActive] = useState(false);
  const [remaining, setRemaining] = useState(6);
  const [done, setDone] = useState<'approved' | 'cancelled' | null>(null);

  useEffect(() => {
    if (!active) return;
    setRemaining(6);
    setDone(null);
    const t = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(t);
          setDone('approved');
          setActive(false);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [active]);

  return (
    <Slide tint="gold" chapter="Etapa 3 · Final Level" title="Gate HITL — 6 segundos para decir que no">
      <div className="grid grid-cols-[1.1fr_1fr] gap-6 items-start">
        <div className="space-y-4 text-cream text-[20px] leading-relaxed">
          <p className="text-[24px] font-display text-gold">
            Seis segundos para decir que no.
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>auto-approve por default</li>
            <li>el cancel siempre gana</li>
            <li>cada gate es un evento</li>
          </ul>
          <p className="text-cream/95">
            Apretá el botón.
          </p>
        </div>
        <div className="dialog-box p-6">
          <span className="pip-bl" /><span className="pip-br" />
          <div className="font-pixel text-[11px] opacity-70">ORCHESTRATOR → FACTORY</div>
          <div className="font-display text-[18px] mt-2 text-cream">
            aprobar BuildPlan v1
          </div>
          <div className="mt-6 flex items-center gap-6">
            <button className="btn-pixel" onClick={() => setActive(true)}>
              DISPARAR GATE
            </button>
            {active && (
              <>
                <div className="font-display text-3xl text-gold">{remaining}s</div>
                <button
                  className="btn-pixel"
                  style={{ color: 'var(--magenta)' }}
                  onClick={() => {
                    setActive(false);
                    setDone('cancelled');
                  }}
                >
                  CANCELAR
                </button>
              </>
            )}
            {done === 'approved' && <div className="text-moss font-pixel">● auto-aprobado</div>}
            {done === 'cancelled' && <div className="text-magenta font-pixel">◌ cancelado por humano</div>}
          </div>
          <div className="mt-5 text-[13px] opacity-70 font-pixel">
            sin timeouts silenciosos
          </div>
        </div>
      </div>
    </Slide>
  );
}
