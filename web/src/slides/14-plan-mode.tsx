import Slide from '@/components/Slide';
import type { SlideProps } from './types';

export const meta = {
  id: '14-plan-mode',
  number: 14,
  chapter: 'Scope A · Claude Code',
  title: 'Plan mode + handoff al agente',
  tint: 'cyan' as const,
  notes: `Línea cruda: "Plan mode es el hábito que más plata me ahorró: antes de tocar un archivo no trivial, pedime un plan. Si el plan tiene mala pinta, la ejecución también."
Punchline no escrito: "El plan cuesta dos minutos. El diff malo cuesta una tarde."
Pregunta probable: "¿Cuándo saltarse plan mode?" → "Cuando es un fix de una línea, o cuando ya estás dentro de un subagent que no va a cambiar de rumbo."`,
};

const steps = [
  { k: 'PLAN', c: 'gold', body: 'Claude propone archivos, orden e invariantes.' },
  { k: 'REVIEW', c: 'cream', body: 'Si huele mal, cortás. Si no, aprobás.' },
  { k: 'HANDOFF', c: 'cyan', body: 'El plan aprobado es el contrato.' },
  { k: 'VERIFY', c: 'moss', body: 'Diff fuera del plan → rollback.' },
];

export default function Slide14({}: SlideProps) {
  return (
    <Slide tint="cyan" chapter="Scope A · Claude Code" title="Plan mode + handoff al agente">
      <div className="grid grid-cols-4 gap-4">
        {steps.map((s, i) => (
          <div key={s.k} className={`dialog-box p-4 tint-${s.c} animate-rise`} style={{ animationDelay: `${i * 80}ms` }}>
            <span className="pip-bl" /><span className="pip-br" />
            <div className="tint-bar -mx-4 -mt-4 mb-3" />
            <div className="font-pixel text-[11px] opacity-70">{`0${i + 1}`.slice(-2)}</div>
            <h3 className="font-display text-lg mt-2 text-cream">{s.k}</h3>
            <p className="mt-3 text-cream/95 text-[18px] leading-snug">{s.body}</p>
          </div>
        ))}
      </div>
      <div className="mt-8 grid grid-cols-2 gap-6 text-[18px]">
        <div className="dialog-box p-4 tint-cyan">
          <span className="pip-bl" /><span className="pip-br" />
          <div className="font-pixel text-[11px] mb-2" style={{ color: 'var(--tint)' }}>PARA QUÉ SIRVE</div>
          <ul className="list-disc pl-5 space-y-1 text-cream">
            <li>alinearse <b>antes</b> del diff</li>
            <li>unidad barata para criticar</li>
            <li>contrato del ejecutor</li>
          </ul>
        </div>
        <div className="dialog-box p-4 tint-orange">
          <span className="pip-bl" /><span className="pip-br" />
          <div className="font-pixel text-[11px] mb-2" style={{ color: 'var(--tint)' }}>PARA QUÉ NO SIRVE</div>
          <ul className="list-disc pl-5 space-y-1 text-cream">
            <li>reemplazar el doc de arquitectura</li>
            <li>spec que shippeás sin diff</li>
            <li>memoria entre runs</li>
          </ul>
        </div>
      </div>
    </Slide>
  );
}
