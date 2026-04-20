import Slide from '@/components/Slide';
import CastCard from '@/components/CastCard';
import type { SlideProps } from './types';

export const meta = {
  id: '17-boardroom-cast',
  number: 17,
  chapter: 'Scope B · Google ADK',
  title: 'El elenco del boardroom',
  tint: 'gold' as const,
  notes: `Línea cruda: "Ocho personajes. Cada uno con un deliverable tipado. El CEO decide quién habla después de quién."
Punchline no escrito: "Es un equipo mejor que algunos donde trabajé."
Pregunta probable: "¿Por qué AgentTool y no sub_agents?" → "Porque sub_agents con output_schema no devuelven el control al padre. AgentTool sí."`,
};

const cast = [
  { codename: 'Theo', role: 'CEO', deliverable: 'coordina la ronda; go/no-go', quote: "Lo hacemos. Rin, estructurá la idea. Marcus, investigá el mercado.", tint: 'gold' as const },
  { codename: 'Rin', role: 'Head of Product', deliverable: 'StrategyBoard', quote: "El usuario necesita esto en tres clics o menos.", tint: 'cyan' as const },
  { codename: 'Marcus', role: 'Head of Research', deliverable: 'MarketAnalysis', quote: "Checking whether this \'trend\' is more than a LinkedIn post...", tint: 'lila' as const },
  { codename: 'Juno', role: 'Creative Director', deliverable: 'Brand', quote: "Navy apagado. Sin gradientes. Pixel pips.", tint: 'magenta' as const },
  { codename: 'Eloise', role: 'COO', deliverable: 'BusinessPlan', quote: "El SMB es la cuña. Enterprise después del v1.", tint: 'orange' as const },
  { codename: 'Yara', role: 'Chief Strategist', deliverable: 'LeanCanvas (9 bloques)', quote: "Si no cierra en un canvas, no cierra en la vida real.", tint: 'moss' as const },
  { codename: 'Sam', role: 'CTO', deliverable: 'BuildPlan', quote: "Esto te lo levanto en una semana. No en dos.", tint: 'cyan' as const },
  { codename: 'Aditi', role: 'Chief of Staff', deliverable: 'PlanReview', quote: "Tu moat es una planilla. Probá de nuevo.", tint: 'magenta' as const },
];

export default function Slide17({}: SlideProps) {
  return (
    <Slide tint="gold" chapter="Scope B · Google ADK" title="El elenco del boardroom — ocho AgentTools, una sesión">
      <div className="grid grid-cols-4 gap-4">
        {cast.map((c, i) => (
          <CastCard key={c.codename} {...c} index={i} />
        ))}
      </div>
      <div className="mt-6 text-cream/95 text-[18px] max-w-[100ch] leading-relaxed">
        Sumar uno es un archivo nuevo, no un rediseño.
      </div>
    </Slide>
  );
}
