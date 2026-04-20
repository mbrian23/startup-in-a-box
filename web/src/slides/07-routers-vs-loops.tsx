import Slide from '@/components/Slide';
import type { SlideProps } from './types';

export const meta = {
  id: '07-routers-vs-loops',
  number: 7,
  chapter: 'Etapa 1 · Setup',
  title: 'Routers vs. loops',
  tint: 'moss' as const,
  notes: `Línea cruda: "Hay dos familias de agentes: el router, que decide una vez a quién mandarle la pelota, y el loop, que itera hasta terminar."
Punchline no escrito: "Los routers fallan rápido; los loops fallan caros."
Pregunta probable: "¿Cuál usa este proyecto?" → "Los dos. ADK es router en la sala de reuniones, el SDK es loop en la fábrica."`,
};

export default function Slide07({}: SlideProps) {
  return (
    <Slide tint="moss" chapter="Etapa 1 · Setup" title="Routers vs. loops">
      <div className="grid grid-cols-2 gap-8 h-full">
        <div className="dialog-box p-6 tint-gold">
          <span className="pip-bl" /><span className="pip-br" />
          <div className="tint-bar -mx-6 -mt-6 mb-5" />
          <div className="font-pixel text-[12px] text-cream/80 tracking-wider">ROUTER</div>
          <h3 className="font-display text-[22px] mt-3 glow-text">decisión one-shot</h3>
          <ul className="mt-5 space-y-3 list-disc pl-5 text-[18px] leading-relaxed">
            <li>elige el próximo experto, una sola vez</li>
            <li>barato y fácil de testear</li>
            <li>muere con ciclos</li>
          </ul>
          <div className="mt-6 text-cream/80 text-[15px] italic">
            boardroom ADK · la mayoría de los chatbots
          </div>
        </div>
        <div className="dialog-box p-6 tint-magenta">
          <span className="pip-bl" /><span className="pip-br" />
          <div className="tint-bar -mx-6 -mt-6 mb-5" />
          <div className="font-pixel text-[12px] text-cream/80 tracking-wider">LOOP</div>
          <h3 className="font-display text-[22px] mt-3 glow-text">while-not-done</h3>
          <ul className="mt-5 space-y-3 list-disc pl-5 text-[18px] leading-relaxed">
            <li>itera, llama tools, re-planifica</li>
            <li>potente, pero la factura crece</li>
            <li>necesita hooks y sandboxes</li>
          </ul>
          <div className="mt-6 text-cream/80 text-[15px] italic">
            supervisor + subagents del SDK · coders tipo Aider
          </div>
        </div>
      </div>
      <div className="mt-8 text-cream text-[22px] leading-relaxed italic">
        “No uses un loop donde alcanzaba un router.”
      </div>
    </Slide>
  );
}
