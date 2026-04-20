import Slide from '@/components/Slide';
import type { SlideProps } from './types';

export const meta = {
  id: '06-tool-calling',
  number: 6,
  chapter: 'Etapa 1 · Setup',
  title: 'Tool calling — el único truco',
  tint: 'moss' as const,
  notes: `Línea cruda: "Los agentes de hoy son, en esencia, un while-loop alrededor de 'dame un JSON de qué querés hacer, te devuelvo qué pasó'."
Punchline no escrito: "El hype es el glaseado. Abajo hay un for-loop."
Pregunta probable: "¿Y las 'reasoning' chains?" → "También un loop, con pasos intermedios que no le mostrás al usuario."`,
};

export default function Slide06({}: SlideProps) {
  return (
    <Slide tint="moss" chapter="Etapa 1 · Setup" title="Tool calling es el único truco">
      <div className="grid grid-cols-2 gap-10 text-[19px]">
        <div className="space-y-6 leading-relaxed">
          <p className="text-[24px]">
            Un <b>tool</b> es un JSON schema.
          </p>
          <p className="text-[24px]">
            Un <b>agente</b> es un loop que pregunta <i>“¿qué sigue?”</i>.
          </p>
          <p className="text-cream/90 text-[22px] italic">
            Todo lo demás es decoración.
          </p>
        </div>
        <div className="dialog-box p-6">
          <span className="pip-bl" /><span className="pip-br" />
          <div className="font-pixel text-[12px] text-cream/75 mb-3 tracking-wider">el loop, sin glaseado</div>
          <pre className="font-mono text-[15px] leading-relaxed whitespace-pre-wrap text-cream">
{`while True:
    resp = model.call(messages, tools=TOOLS)
    if resp.stop_reason == "end_turn":
        break
    for call in resp.tool_calls:
        result = run(call.name, call.args)
        messages.append(tool_result(call.id, result))`}
          </pre>
          <div className="mt-5 text-cream/90 text-[15px] italic">
            Seis líneas. El resto es elegancia.
          </div>
        </div>
      </div>
    </Slide>
  );
}
