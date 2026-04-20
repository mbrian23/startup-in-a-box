import Slide from '@/components/Slide';
import type { SlideProps } from './types';

// Slide id stays `18-output-schema-trap` to avoid reshuffling the registry,
// but the content now covers ADK composition tactics — more useful than the
// single output_schema gotcha on its own. The trap itself is mentioned as
// a one-liner inside the LoopAgent card.

export const meta = {
  id: '18-output-schema-trap',
  number: 18,
  chapter: 'Scope B · Google ADK',
  title: 'Cómo componer agentes en ADK',
  tint: 'gold' as const,
  notes: `Línea cruda: "En ADK no hay una sola forma de armar el flujo. Hay cinco, y cada una resuelve un problema distinto: hand-offs, AgentAsATool, Sequential, Parallel y Loop."
Punchline no escrito: "Si conocés una sola, vas a meterla en todos lados. Es como tener un martillo."
Pregunta probable: "¿Y output_schema?" → "Cualquier LlmAgent con output_schema no puede llamar tools. El escape hatch es partirlo en dos con Sequential: worker con tools, reviewer con schema."`,
};

type Card = {
  k: string;
  name: string;
  when: string;
  code: string;
  tint: 'gold' | 'cyan' | 'magenta' | 'moss' | 'lila' | 'orange';
};

const cards: Card[] = [
  {
    k: '01',
    name: 'Hand-off',
    when: 'El CEO le pasa la posta al CTO.',
    code: `# transfer_to_agent=True en el reply
# del CEO → ADK rutea al CTO y deja
# el dict en state["ceo"] disponible.
AGENT_ROLES["ceo"].transfer_to(
    AGENT_ROLES["cto"],
    reason="feasibility",
)`,
    tint: 'gold',
  },
  {
    k: '02',
    name: 'AgentAsATool',
    when: 'Un agente usa a otro como tool.',
    code: `research = LlmAgent(name="research", ...)

writer = LlmAgent(
  name="writer",
  tools=[AgentTool(agent=research)],
)
# writer decide cuándo invocar research
# y recibe su output como tool_result.`,
    tint: 'cyan',
  },
  {
    k: '03',
    name: 'SequentialAgent',
    when: 'Pipeline fijo: A → B → C.',
    code: `pipeline = SequentialAgent(
  agents=[
    worker,    # tools, no schema
    reviewer,  # schema, no tools
  ],
)
# Resuelve la "trampa": worker produce
# prosa, reviewer la colapsa a JSON.`,
    tint: 'magenta',
  },
  {
    k: '04',
    name: 'ParallelAgent',
    when: 'Fan-out a N agentes, gather.',
    code: `fan_out = ParallelAgent(
  agents=[
    market_scanner,
    competitor_scanner,
    legal_scanner,
  ],
)
# ADK espera los tres en paralelo y te
# deja los outputs en session.state.`,
    tint: 'moss',
  },
  {
    k: '05',
    name: 'LoopAgent',
    when: 'Iterás hasta cumplir la condición.',
    code: `loop = LoopAgent(
  agent=reviewer_cycle,
  max_iterations=3,
  should_stop=lambda s: s["score"] >= 4,
)
# Dos o tres pasadas alcanzan.
# Más de tres, el problema es el prompt.`,
    tint: 'orange',
  },
  {
    k: '06',
    name: 'sub_agents vs tools',
    when: 'Decide por vos: sub_agent. Devuelve datos: tool.',
    code: `# sub_agents → el hijo puede decidir
# transfer_to_agent y cambiar el flujo.
# tools → siempre vuelve al caller.

LlmAgent(
  name="ceo",
  sub_agents=[cto, bp, designer],
  tools=[calendar_tool],
)`,
    tint: 'lila',
  },
];

export default function Slide18({}: SlideProps) {
  return (
    <Slide tint="gold" chapter="Scope B · Google ADK" title="Cómo componer agentes en ADK">
      <div className="grid grid-cols-3 gap-4">
        {cards.map((c, i) => (
          <div
            key={c.k}
            className={`dialog-box p-4 tint-${c.tint} animate-rise`}
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <span className="pip-bl" /><span className="pip-br" />
            <div className="tint-bar -mx-4 -mt-4 mb-3" />
            <div className="flex items-baseline justify-between">
              <span className="font-pixel text-[11px] text-cream/80">{c.k}</span>
              <span className="font-display text-[17px] text-cream glow-text">{c.name}</span>
            </div>
            <div className="mt-3 text-cream/95 text-[15px] leading-snug">{c.when}</div>
            <pre className="mt-3 font-mono text-[12.5px] leading-[1.55] p-3 bg-dialog2 border-l-[3px] whitespace-pre overflow-hidden"
                 style={{ borderColor: 'var(--tint)' }}>
{c.code}
            </pre>
          </div>
        ))}
      </div>
      <div className="mt-5 text-cream/95 text-[17px] max-w-[100ch] leading-relaxed">
        Si conocés una sola, la vas a meter en todos lados.
      </div>
    </Slide>
  );
}
