import Slide from '@/components/Slide';
import type { SlideProps } from './types';

export const meta = {
  id: '08-claude-code-teaser',
  number: 8,
  chapter: 'Etapa 1 · Setup',
  title: 'Claude Code — el IDE al que podés delegar',
  tint: 'moss' as const,
  notes: `Línea cruda: "Antes de llegar a los runtimes, un spoiler: este repo lo construí con Claude Code. Es el IDE que te permite delegar de verdad."
Punchline no escrito: "No es cursor con esteroides. Es tu teclado con criterio."
Pregunta probable: "¿Skill vs Plugin?" → "Skill son instrucciones empaquetadas; plugin te agrega comandos/hooks. Lo desarmo en el siguiente scope."`,
};

export default function Slide08({}: SlideProps) {
  return (
    <Slide tint="moss" chapter="Etapa 1 · Setup" title="Claude Code — el IDE al que podés delegar">
      <div className="grid grid-cols-[1.3fr_1fr] gap-10 items-start">
        <div className="space-y-6 text-[22px] leading-relaxed">
          <p>
            Este repo lo escribió <b>Claude Code</b>.
          </p>
          <p className="italic text-cream/90">
            “No es cursor con esteroides. Es tu teclado con criterio.”
          </p>
        </div>
        <div className="dialog-box p-5 tint-cyan">
          <span className="pip-bl" /><span className="pip-br" />
          <div className="font-pixel text-[12px] mb-4 tracking-wider" style={{ color: 'var(--tint)' }}>
            LO QUE VAS A APRENDER EN SCOPE A
          </div>
          <ul className="list-disc pl-5 space-y-3 text-[17px] leading-relaxed">
            <li>plugins que sobrevivieron</li>
            <li>la deck es un skill</li>
            <li>hooks que me frenaron a tiempo</li>
            <li>plan mode: barato y obligatorio</li>
          </ul>
        </div>
      </div>
    </Slide>
  );
}
