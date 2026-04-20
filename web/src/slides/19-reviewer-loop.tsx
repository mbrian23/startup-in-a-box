import Slide from '@/components/Slide';
import Diagram from '@/components/Diagram';
import type { SlideProps } from './types';

export const meta = {
  id: '19-reviewer-loop',
  number: 19,
  chapter: 'Scope B · Google ADK',
  title: 'Loop de reviewer — crítico → reescritor → crítico',
  tint: 'gold' as const,
  notes: `Línea cruda: "Un patrón que se repite: un crítico que lee, un reescritor que corrige, y el crítico de vuelta. Dos o tres pasadas alcanzan casi siempre."
Punchline no escrito: "Un LLM solo es optimista. Dos se acusan mutuamente. Tres se ponen de acuerdo."
Pregunta probable: "¿Cuándo cortar?" → "O por score del crítico, o por max iteraciones. Si iterás más de tres veces, el problema no es el loop, es el prompt."`,
};

const chart = `
flowchart LR
  classDef agent fill:#1C2A4C,stroke:#D4A84A,color:#ECDFC0,stroke-width:2px,font-size:16px;
  classDef judge fill:#1C2A4C,stroke:#C45A5A,color:#ECDFC0,stroke-width:2px,font-size:16px;
  classDef gate fill:#121C38,stroke:#7A9E56,color:#ECDFC0,stroke-width:2px,font-size:15px;

  W["Worker<br/>tools, no schema"]:::agent
  C["Critic<br/>scores 1-5 + notes"]:::judge
  R["Rewriter<br/>applies notes"]:::agent
  D{{"score >= 4<br/>or iters == 3?"}}:::gate
  OUT["Reviewer<br/>output_schema"]:::agent

  W --> C --> D
  D -- no --> R --> C
  D -- yes --> OUT
`;

export default function Slide19({}: SlideProps) {
  return (
    <Slide tint="gold" chapter="Scope B · Google ADK" title="Loop de reviewer — crítico → reescritor → crítico">
      <Diagram chart={chart} caption="el loop tal como vive en el orchestrator" />
    </Slide>
  );
}
