import Slide from '@/components/Slide';
import type { SlideProps } from './types';

export const meta = {
  id: '03-dumb-idea',
  number: 3,
  chapter: 'Intro',
  title: 'La idea tonta',
  tint: 'cream' as const,
  notes: `Línea cruda: "La idea tonta era: '¿y si junto dos runtimes distintos de agentes y los pongo a fingir que son una empresa?'"
Punchline no escrito: "Spoiler: fingen mejor que algunas empresas reales."
Pregunta probable: "¿Por qué dos runtimes?" → "Porque cada uno tiene una fortaleza que el otro no. Lo explico en el thesis slide."`,
};

export default function Slide03({}: SlideProps) {
  return (
    <Slide tint="cream" chapter="Intro" title="La idea tonta">
      <div className="grid grid-cols-2 gap-10 items-start text-[20px]">
        <div className="dialog-box p-6">
          <span className="pip-bl" /><span className="pip-br" />
          <div className="font-pixel text-[12px] text-gold mb-4 tracking-wider">¿QUÉ PASA SI…</div>
          <p className="text-cream text-[22px]">
            …dos runtimes de agentes manejan una empresa a partir de una oración?
          </p>
          <div className="mt-5 p-4 border-l-4 border-gold text-cream text-[22px] font-pixel leading-relaxed">
            “armame una herramienta de IA para X”
          </div>
        </div>

        <div className="space-y-6">
          <div className="dialog-box p-5 tint-magenta">
            <span className="pip-bl" /><span className="pip-br" />
            <div className="font-pixel text-[12px] mb-3 tracking-wider" style={{ color: 'var(--tint)' }}>
              SE PONE MÁS RARO
            </div>
            <ul className="list-disc pl-5 space-y-2.5 text-cream">
              <li>no hablan el mismo idioma</li>
              <li>uno piensa en sesiones, el otro en sandboxes</li>
              <li>un único reducer los pinta en pixel</li>
            </ul>
          </div>
          <div className="dialog-box p-5 tint-cyan">
            <span className="pip-bl" /><span className="pip-br" />
            <div className="font-pixel text-[12px] mb-3 tracking-wider" style={{ color: 'var(--tint)' }}>
              POR QUÉ ESTA CHARLA ES DISTINTA
            </div>
            <p className="text-cream text-[22px]">
              El browser que estás mirando <b>es la charla</b>.
            </p>
          </div>
        </div>
      </div>
    </Slide>
  );
}
