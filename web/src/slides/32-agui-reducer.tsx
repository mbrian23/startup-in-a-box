import Slide from '@/components/Slide';
import Diagram from '@/components/Diagram';
import type { SlideProps } from './types';

export const meta = {
  id: '32-agui-reducer',
  number: 32,
  chapter: 'Etapa 3 · Final Level',
  title: 'AG-UI — un reducer, dos backends',
  tint: 'gold' as const,
  notes: `Línea cruda: "AG-UI es el protocolo. Define tipos de eventos, actores, deltas de texto. El frontend tiene un solo reducer y no sabe si el evento vino de ADK o del SDK."
Punchline no escrito: "El reducer es el único componente del stack que no tiene drama."
Pregunta probable: "¿Por qué SSE y no WebSocket?" → "Unidireccional nos alcanza. SSE reconecta solo, y los proxys lo respetan."`,
};

const chart = `
flowchart LR
  classDef svc fill:#1C2A4C,stroke:#D4A84A,color:#ECDFC0,stroke-width:2px,font-size:16px;
  classDef sdk fill:#1C2A4C,stroke:#C45A5A,color:#ECDFC0,stroke-width:2px,font-size:16px;
  classDef fe  fill:#121C38,stroke:#6BA8B8,color:#ECDFC0,stroke-width:2px,font-size:16px;
  classDef proto fill:#121C38,stroke:#7A9E56,color:#ECDFC0,stroke-dasharray:4 4,font-size:13px;

  subgraph Orch[":8000 orchestrator"]
    A["ADK boardroom"]:::svc
  end
  subgraph Fact[":8888 factory"]
    S["Supervisor + subagents"]:::sdk
  end
  PROTO[["AG-UI protocol<br/>RUN_STARTED · AGENT_TURN<br/>TEXT_DELTA · TOOL_USE · HITL_GATE"]]:::proto

  A -- SSE --> PROTO
  S -- SSE --> PROTO
  PROTO -- events --> R["single reducer"]:::fe --> UI["pixel office + chat"]:::fe
`;

export default function Slide32({}: SlideProps) {
  return (
    <Slide tint="gold" chapter="Etapa 3 · Final Level" title="AG-UI — un reducer, dos backends">
      <Diagram chart={chart} caption="un reducer, dos backends" />
    </Slide>
  );
}
