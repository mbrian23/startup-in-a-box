import Slide from '@/components/Slide';
import type { SlideProps } from './types';

export const meta = {
  id: '09-stage1-close',
  number: 9,
  chapter: 'Etapa 1 · Setup',
  title: 'Etapa 1 — repaso',
  tint: 'moss' as const,
  notes: `Línea cruda: "Cinco slides, tres ideas: agentes son loops, routers son baratos y Claude Code es el IDE con criterio. Ya está. Entramos al código."
Punchline no escrito: "Si te perdiste alguno, presioná '/', el deck es interactivo."
Pregunta probable: "¿Cuánto falta para ver código?" → "Un slide."`,
};

export default function Slide09({}: SlideProps) {
  return (
    <Slide tint="moss" chapter="Etapa 1 · Setup" title="Repaso — tres ideas, tres capítulos">
      <div className="grid grid-cols-3 gap-6 h-full">
        {[
          { t: 'Los agentes son loops', b: 'Tool call → result → repetir.' },
          { t: 'Routers > loops cuando se puede', b: 'No clasifiques con loop. No construyas con router.' },
          { t: 'Claude Code se ganó la silla', b: 'Plugins, skills, hooks, plan mode.' },
        ].map((c, i) => (
          <div key={c.t} className="dialog-box p-6 tint-moss">
            <span className="pip-bl" /><span className="pip-br" />
            <div className="font-pixel text-[11px] text-cream/75 tracking-wider">IDEA {i + 1}</div>
            <h3 className="font-display text-[20px] mt-4 text-cream glow-text leading-snug">{c.t}</h3>
            <p className="mt-5 text-cream/95 text-[18px] leading-relaxed">{c.b}</p>
          </div>
        ))}
      </div>
      <div className="mt-8 font-pixel text-[13px] text-cream/80 caret tint-moss tracking-wider">
        SIGUE · SCOPE A · CLAUDE CODE COMO ENTORNO DE DESARROLLO
      </div>
    </Slide>
  );
}
