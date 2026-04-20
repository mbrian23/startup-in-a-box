import Slide from '@/components/Slide';
import type { SlideProps } from './types';

export const meta = {
  id: '04-thesis',
  number: 4,
  chapter: 'Intro',
  title: 'Tesis — dos runtimes, una charla',
  tint: 'cream' as const,
  notes: `Línea cruda: "Mi tesis es: hoy necesitás al menos dos runtimes, uno para razonar y otro para ejecutar. No sirve meter todo en un solo agente gigante."
Punchline no escrito: "Si te vendieron el único agente que todo lo puede, te cobraron de más."
Pregunta probable: "¿Por qué no un LangGraph y listo?" → "Podés. Pero ADK te regala el manejo de sesión y el SDK te regala la sandbox y las herramientas. Reescribir eso es una tarde perdida."`,
};

const rows = [
  {
    who: 'Google ADK',
    role: 'la sala de reuniones',
    strength: 'LlmAgent, sesiones, output_schema, reviewer loops',
    color: 'gold',
  },
  {
    who: 'Claude Agent SDK',
    role: 'la fábrica',
    strength: 'supervisor + subagents, permisos por tier, shell hermético',
    color: 'magenta',
  },
  {
    who: 'Protocolo AG-UI',
    role: 'el puente',
    strength: 'un reducer, dos backends, eventos tipados sobre SSE',
    color: 'cyan',
  },
];

export default function Slide04({}: SlideProps) {
  return (
    <Slide tint="cream" chapter="Intro" title="Dos runtimes, una charla">
      <div className="grid grid-cols-3 gap-6 h-full">
        {rows.map((r, i) => (
          <div key={r.who} className={`dialog-box p-6 tint-${r.color}`}>
            <span className="pip-bl" /><span className="pip-br" />
            <div className="tint-bar -mx-6 -mt-6 mb-5" />
            <div className="font-pixel text-[12px] text-cream/70 tracking-wider">{`0${i + 1}`.slice(-2)}</div>
            <div className="font-display text-[22px] mt-3 text-cream glow-text">{r.who}</div>
            <div className="mt-2 text-cream/90 italic text-[18px]">{r.role}</div>
            <div className="mt-6 text-cream text-[18px] leading-relaxed">{r.strength}</div>
          </div>
        ))}
      </div>
      <div className="mt-10 text-cream text-[24px] max-w-[95ch] leading-relaxed italic">
        “Dejá que cada runtime haga lo que hace bien.”
      </div>
    </Slide>
  );
}
