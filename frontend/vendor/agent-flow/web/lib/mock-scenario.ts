// Demo mock scenario — replayed when useMockData is true (offline/demo mode).
// The real app disables mocks via useAgentFlowBridge (showMockData: false).

import type { SimulationEvent } from './agent-types'

const SESSION = 'demo-factory-session'

function ev(time: number, type: SimulationEvent['type'], payload: Record<string, unknown>): SimulationEvent {
  return { time, type, payload, sessionId: SESSION }
}

export const MOCK_SCENARIO: SimulationEvent[] = [
  ev(0.5, 'agent_spawn', { name: 'claude', isMain: true, task: 'Build and deploy the startup MVP', model: 'claude-sonnet-4-6' }),
  ev(0.8, 'message', { agent: 'claude', role: 'thinking', content: 'A marketplace for half-used candles. The boardroom actually approved this. Let me read the build plan before I lose faith in the process.' }),

  ev(1.5, 'tool_call_start', { agent: 'claude', tool: 'Bash', args: 'npx create-next-app@latest candle-marketplace --ts --tailwind --app' }),
  ev(3.0, 'message', { agent: 'claude', role: 'assistant', content: 'Next.js scaffold ready. Time to define what a "pre-loved candle" actually looks like in TypeScript.' }),
  ev(3.5, 'tool_call_end', { agent: 'claude', tool: 'Bash', result: 'Project initialized successfully' }),

  ev(4.0, 'tool_call_start', { agent: 'claude', tool: 'Write', args: 'src/lib/schema.ts' }),
  ev(4.5, 'context_update', { agent: 'claude', breakdown: { systemPrompt: 4200, userMessages: 1800, toolResults: 3200, reasoning: 2400, subagentResults: 0 } }),
  ev(5.2, 'message', { agent: 'claude', role: 'thinking', content: 'burn_pct range: 1–99. A 100% burned candle is just a jar with regret in it. Clamping.' }),
  ev(5.5, 'tool_call_end', { agent: 'claude', tool: 'Write', result: 'Candle listing schema with price, burn %, scent, and condition fields' }),

  ev(6.0, 'message', { agent: 'claude', role: 'thinking', content: 'Four UI components, zero shared state with the API. Perfect subagent boundary — parallelizing.' }),
  ev(6.5, 'subagent_dispatch', { parent: 'claude', child: 'frontend-agent', task: 'Build browse and listing UI components' }),
  ev(6.8, 'agent_spawn', { name: 'frontend-agent', parent: 'claude', task: 'Build browse and listing UI', model: 'claude-sonnet-4-6' }),
  ev(7.0, 'message', { agent: 'frontend-agent', role: 'thinking', content: 'Reading schema.ts first. I refuse to build a card component that gets the types wrong on the first try.' }),

  ev(7.5, 'tool_call_start', { agent: 'frontend-agent', tool: 'Write', args: 'src/components/CandleCard.tsx' }),
  ev(8.0, 'tool_call_start', { agent: 'claude', tool: 'Write', args: 'src/app/api/listings/route.ts' }),
  ev(8.3, 'message', { agent: 'claude', role: 'thinking', content: 'Sorting by burn_pct ascending — freshest wax first. Nobody wants to browse the saddest candles up top.' }),
  ev(8.5, 'tool_call_end', { agent: 'frontend-agent', tool: 'Write', result: 'Card component with burn gauge and scent tags' }),

  ev(8.8, 'message', { agent: 'frontend-agent', role: 'assistant', content: 'CandleCard: radial burn gauge (green→amber→red), scent tags as frosted pills. The sadder the candle, the warmer the color.' }),
  ev(9.0, 'tool_call_start', { agent: 'frontend-agent', tool: 'Write', args: 'src/app/browse/page.tsx' }),
  ev(9.5, 'tool_call_end', { agent: 'claude', tool: 'Write', result: 'CRUD endpoints for candle listings' }),
  ev(10.0, 'tool_call_start', { agent: 'claude', tool: 'Write', args: 'src/app/api/checkout/route.ts' }),
  ev(10.2, 'message', { agent: 'frontend-agent', role: 'thinking', content: 'Sticky sidebar with scent filters. Adding a "Surprise Me" button that picks a random candle — because who really knows what scent they want in a used candle.' }),
  ev(10.5, 'tool_call_end', { agent: 'frontend-agent', tool: 'Write', result: 'Browse page with responsive grid and scent filter' }),
  ev(11.0, 'tool_call_end', { agent: 'claude', tool: 'Write', result: 'Stripe checkout session creation' }),
  ev(11.2, 'message', { agent: 'claude', role: 'assistant', content: 'Stripe wired with test keys. Real checkout flow, fake money. The webhook stub logs "someone actually bought a used candle" to the console.' }),
  ev(11.5, 'context_update', { agent: 'claude', breakdown: { systemPrompt: 4200, userMessages: 1800, toolResults: 12400, reasoning: 6800, subagentResults: 2200 } }),

  ev(12.0, 'tool_call_start', { agent: 'frontend-agent', tool: 'Write', args: 'src/components/ListingDetail.tsx' }),
  ev(12.5, 'message', { agent: 'frontend-agent', role: 'thinking', content: 'The CTA should acknowledge the absurdity. "Give This Candle a Second Chance" hits the right tone.' }),
  ev(13.0, 'tool_call_end', { agent: 'frontend-agent', tool: 'Write', result: 'Detail view with image gallery, burn percentage indicator, and buy button' }),
  ev(13.5, 'message', { agent: 'frontend-agent', role: 'assistant', content: 'Done. Browse → detail → checkout wired end to end. The empty state says "No candles found. Everyone finished theirs."' }),
  ev(14.0, 'agent_complete', { name: 'frontend-agent' }),
  ev(14.2, 'subagent_return', { parent: 'claude', child: 'frontend-agent', result: '4 components built: CandleCard, Browse page, ListingDetail, CheckoutForm' }),

  ev(14.5, 'message', { agent: 'claude', role: 'thinking', content: 'Frontend landed clean. Seeding 12 candles — need names that make people screenshot the demo.' }),
  ev(15.5, 'tool_call_start', { agent: 'claude', tool: 'Write', args: 'src/lib/seed-data.ts' }),
  ev(16.0, 'message', { agent: 'claude', role: 'assistant', content: 'Seed data: "Existential Vanilla" at 73% burn, "Midlife Crisis Mahogany" at 22%, "Ghosted Gardenia" at 91%...' }),
  ev(16.5, 'tool_call_end', { agent: 'claude', tool: 'Write', result: 'Seed data: 12 half-used candles with realistic metadata' }),

  ev(17.0, 'tool_call_start', { agent: 'claude', tool: 'Bash', args: 'npm run build' }),
  ev(18.0, 'message', { agent: 'claude', role: 'thinking', content: 'Type-checking 14 files... if the subagent mismatched a prop type I\'ll know in about 3 seconds.' }),
  ev(19.0, 'message', { agent: 'claude', role: 'assistant', content: 'Clean build. Zero errors, zero warnings. Slightly concerned about how well this is going.' }),
  ev(19.5, 'tool_call_end', { agent: 'claude', tool: 'Bash', result: 'Build completed — 0 errors, 0 warnings' }),

  ev(20.0, 'tool_call_start', { agent: 'claude', tool: 'Bash', args: 'vercel deploy --prod' }),
  ev(21.0, 'message', { agent: 'claude', role: 'thinking', content: 'Deploying to production. Edge functions for the API, ISR for the browse page. This candle marketplace will be globally distributed whether the world asked for it or not.' }),
  ev(22.0, 'tool_call_end', { agent: 'claude', tool: 'Bash', result: 'Deployed to candle-marketplace.vercel.app' }),

  ev(22.5, 'message', { agent: 'claude', role: 'assistant', content: 'Live. A real, deployed marketplace for candles nobody finished burning. The boardroom was right — this is exactly what the world needed.' }),
  ev(23.0, 'context_update', { agent: 'claude', breakdown: { systemPrompt: 4200, userMessages: 1800, toolResults: 18600, reasoning: 9400, subagentResults: 3800 } }),
  ev(24.0, 'agent_complete', { name: 'claude' }),
]

export const MOCK_DURATION = 25
