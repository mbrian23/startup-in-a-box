import Slide from '@/components/Slide';
import type { SlideProps } from './types';

export const meta = {
  id: '29-demo-stack',
  number: 29,
  chapter: 'Etapa 3 · Final Level',
  title: 'Demo stack — tres servicios, un solo reducer',
  tint: 'gold' as const,
  notes: `Línea cruda: "Tres servicios: orchestrator en 8000, factory en 8888, frontend en 3000. La deck que estás viendo corre en 7833. Cuatro puertos, cuatro responsabilidades."
Punchline no escrito: "Si alguno se cae, el resto sigue con cara de circunstancia."
Pregunta probable: "¿Por qué separar factory del orquestrador?" → "Porque la fábrica corre como proceso aparte, con su propio sandbox. Compartir proceso sería compartir blast radius."`,
};

const services = [
  {
    name: 'Orchestrator',
    port: ':8000',
    runtime: 'FastAPI + Google ADK',
    responsibility: 'Corre el boardroom.',
    tint: 'gold',
  },
  {
    name: 'Factory',
    port: ':8888',
    runtime: 'FastAPI + Claude Agent SDK',
    responsibility: 'Supervisor + subagentes.',
    tint: 'magenta',
  },
  {
    name: 'Frontend',
    port: ':3000',
    runtime: 'Next.js + React + PixiJS',
    responsibility: 'Pinta la oficina pixel.',
    tint: 'cyan',
  },
  {
    name: 'Esta deck',
    port: ':7833',
    runtime: 'Next.js (sin backend)',
    responsibility: 'Estática, offline, embebible.',
    tint: 'moss',
  },
];

export default function Slide29({}: SlideProps) {
  return (
    <Slide tint="gold" chapter="Etapa 3 · Final Level" title="Demo stack — tres servicios, un solo reducer">
      <div className="grid grid-cols-4 gap-4">
        {services.map((s, i) => (
          <div key={s.name} className={`dialog-box p-4 tint-${s.tint} animate-rise`} style={{ animationDelay: `${i * 80}ms` }}>
            <span className="pip-bl" /><span className="pip-br" />
            <div className="tint-bar -mx-4 -mt-4 mb-3" />
            <div className="font-pixel text-[10px] opacity-70">{s.port}</div>
            <h3 className="font-display text-[18px] mt-2 text-cream">{s.name}</h3>
            <div className="mt-2 text-[14px] text-cream/90">{s.runtime}</div>
            <p className="mt-3 text-cream text-[18px] leading-snug">{s.responsibility}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 text-cream/95 text-[20px] max-w-[100ch] leading-relaxed">
        Cuatro puertos, una sola máquina de estado.
      </div>
    </Slide>
  );
}
