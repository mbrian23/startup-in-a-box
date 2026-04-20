import Slide from '@/components/Slide';
import type { SlideProps } from './types';

export const meta = {
  id: '34-lessons',
  number: 34,
  chapter: 'Etapa 3 · Final Level',
  title: 'Lecciones aprendidas y bloopers',
  tint: 'gold' as const,
  notes: `Línea cruda: "Lecciones y bloopers. Dos de los bloopers valieron más que cualquier tutorial: el día que un commit filtró 398 líneas de CSS global, y el día que Pili terminó clasificando tiles a mano porque el AI no podía."
Punchline no escrito: "Hay tareas donde un humano con un mouse gana 10 a 0."
Pregunta probable: "¿La tile classifier es público?" → "Todavía no. Fue una microapp interna. La intención era fast-fail, no producto."`,
};

const lessons = [
  'Router le gana a loop.',
  'output_schema desactiva tools.',
  'Sandbox hermético > confianza.',
  'Skills con doble camino: mock o real.',
  'El schema del handoff es el contrato.',
  'AG-UI: al frontend no le importa.',
];

export default function Slide34({}: SlideProps) {
  return (
    <Slide tint="gold" chapter="Etapa 3 · Final Level" title="Lecciones aprendidas y bloopers">
      <div className="grid grid-cols-[1.1fr_1fr] gap-6 h-full">
        <div>
          <div className="font-pixel text-[11px] opacity-80 mb-2">SEIS LECCIONES</div>
          <ul className="space-y-2">
            {lessons.map((l, i) => (
              <li key={i} className="dialog-box p-3 animate-rise" style={{ animationDelay: `${i * 50}ms` }}>
                <span className="pip-bl" /><span className="pip-br" />
                <div className="grid grid-cols-[28px_1fr] items-start gap-3">
                  <span className="font-pixel text-[12px] text-gold">{String(i + 1).padStart(2, '0')}</span>
                  <span className="text-cream text-[18px] leading-snug">{l}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-4">
          <div className="font-pixel text-[11px] text-magenta">BLOOPERS · COSAS DIVERTIDAS</div>

          <div className="dialog-box p-4 tint-magenta">
            <span className="pip-bl" /><span className="pip-br" />
            <div className="font-pixel text-[12px] mb-1" style={{ color: 'var(--tint)' }}>
              commit c12ee0a — la fuga del globals.css
            </div>
            <div className="text-cream/95 text-[18px] leading-snug">
              Un build appendeó <b>398 líneas</b> de CSS al <code>globals.css</code> de la app. Toda la deck amaneció con un gradiente que nadie pidió.
            </div>
          </div>

          <div className="dialog-box p-4 tint-orange">
            <span className="pip-bl" /><span className="pip-br" />
            <div className="font-pixel text-[12px] mb-1" style={{ color: 'var(--tint)' }}>
              el incidente de los tiles de Pili
            </div>
            <div className="grid grid-cols-[140px_1fr] gap-3 items-start">
              <img
                src="/pili-tiles.jpg"
                alt="Pili moviendo tiles a mano en una webapp chiquita de clasificación de tiles"
                className="w-full h-auto border-2 border-cream"
              />
              <div className="text-cream/95 text-[18px] leading-snug">
                El AI no podía clasificar los tiles. Pili arrastró 1200 a mano y ganó. Humano-con-mouse: 1 · AI: 0.
              </div>
            </div>
          </div>
        </div>
      </div>
    </Slide>
  );
}
