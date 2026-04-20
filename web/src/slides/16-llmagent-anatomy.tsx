import Slide from '@/components/Slide';
import CodeView from '@/components/CodeView';
import type { SlideProps } from './types';

export const meta = {
  id: '16-llmagent-anatomy',
  number: 16,
  chapter: 'Scope B · Google ADK',
  title: 'Anatomía de un LlmAgent',
  tint: 'gold' as const,
  notes: `Línea cruda: "Un LlmAgent es nombre, modelo, instrucción, herramientas, y un schema opcional para lo que devuelve. Lo importante es lo que no está en esa lista: el manejo de sesión."
Punchline no escrito: "Es DTO con vida propia."
Pregunta probable: "¿Qué es session.state?" → "Un diccionario compartido entre todos los LlmAgent de la sesión. Es donde el CEO le deja el plan al CTO."`,
};

export default function Slide16({}: SlideProps) {
  return (
    <Slide tint="gold" chapter="Scope B · Google ADK" title="Anatomía de un LlmAgent">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-6 h-full">
        <div className="space-y-4 text-[18px] text-cream/95">
          <p>La clase es chica. El contrato es grande.</p>
          <ul className="list-disc pl-5 space-y-2">
            <li><code className="text-gold">name</code> — clave estable</li>
            <li><code className="text-gold">model</code> — por agente, no global</li>
            <li><code className="text-gold">instruction</code> — la persona, sin ambigüedad</li>
            <li><code className="text-gold">tools</code> — callables; ADK arma los schemas</li>
            <li><code className="text-gold">output_schema</code> — Pydantic obligatorio</li>
            <li className="opacity-90"><code>session.state</code> — el dict compartido</li>
          </ul>
        </div>
        <CodeView
          path="orchestrator/adk_apps/ceo/agent.py"
          language="python"
          caption="el agente CEO del boardroom, tal cual está en el repo"
        />
      </div>
    </Slide>
  );
}
