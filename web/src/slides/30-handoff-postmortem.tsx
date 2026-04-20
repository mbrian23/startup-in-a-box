import Slide from '@/components/Slide';
import type { SlideProps } from './types';

export const meta = {
  id: '30-handoff-postmortem',
  number: 30,
  chapter: 'Etapa 3 · Final Level',
  title: 'Post-mortem del handoff',
  tint: 'gold' as const,
  notes: `Línea cruda: "Cada run, si la fábrica se niega a arrancar, generamos un post-mortem automático: qué campo estaba mal, qué valor esperaba, qué valor llegó. No hay que hacer forensics en los logs."
Punchline no escrito: "El modo 'a ver quién rompió el schema' me llevó muchos días. Ahora es un archivo."
Pregunta probable: "¿Qué runtime lo escribe?" → "La factory, porque es quien rechaza el plan. El orquestrador solo archiva."`,
};

const cases = [
  {
    sym: 'la factory no arranca',
    cause: 'BuildPlan rechazó una key desconocida',
    fix: 'el reviewer reintenta con el schema.',
  },
  {
    sym: 'el subagente se frena',
    cause: 'mismatch de tier: pidió Bash',
    fix: 'replanifica o escala de tier.',
  },
  {
    sym: 'la aprobación HITL expira',
    cause: 'humano AFK: se venció el gate',
    fix: 'pausa + link de resume.',
  },
  {
    sym: 'evento downstream huérfano',
    cause: 'race en el reducer del frontend',
    fix: 'bufferear por actor-id.',
  },
];

export default function Slide30({}: SlideProps) {
  return (
    <Slide tint="gold" chapter="Etapa 3 · Final Level" title="Post-mortem del handoff — los cuatro bugs más útiles">
      <div className="grid grid-cols-2 gap-4">
        {cases.map((c, i) => (
          <div key={c.sym} className="dialog-box p-4 animate-rise" style={{ animationDelay: `${i * 60}ms` }}>
            <span className="pip-bl" /><span className="pip-br" />
            <div className="font-pixel text-[11px] text-orange">SÍNTOMA</div>
            <div className="mt-1 text-cream font-pixel text-[14px]">{c.sym}</div>
            <div className="mt-3 font-pixel text-[11px] text-magenta">CAUSA</div>
            <div className="mt-1 text-[18px] text-cream/95">{c.cause}</div>
            <div className="mt-3 font-pixel text-[11px] text-moss">FIX</div>
            <div className="mt-1 text-[18px] text-cream/95">{c.fix}</div>
          </div>
        ))}
      </div>
      <div className="mt-6 text-cream/95 text-[20px] leading-relaxed max-w-[100ch]">
        El bug más caro es el que no podés reproducir.
      </div>
    </Slide>
  );
}
