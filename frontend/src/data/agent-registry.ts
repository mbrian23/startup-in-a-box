/**
 * Unified agent registry — single source of truth for agent metadata.
 *
 * OCP: add a new agent by appending to AGENT_REGISTRY; no other file changes.
 */

export interface AgentDef {
  agentName: string;
  characterId: string;
  displayName: string;
  outputKey?: string;
  phaseBannerEnter?: string;
  phaseBannerFrom?: Record<string, string>;
}

export const AGENT_REGISTRY: readonly AgentDef[] = [
  {
    agentName: 'ceo',
    characterId: 'ceo',
    displayName: 'Theo Vance · CEO',
    phaseBannerEnter: 'KICKOFF',
  },
  {
    agentName: 'data_structurer',
    characterId: 'visionary',
    displayName: 'Rin Ogawa · Head of Product',
    outputKey: 'strategy_board',
    phaseBannerEnter: 'PRODUCT STRATEGY',
    phaseBannerFrom: {
      ceo: 'CEO → Product',
    },
  },
  {
    agentName: 'market_analyst',
    characterId: 'scout',
    displayName: 'Marcus Chen · Head of Research',
    outputKey: 'market_analysis',
    phaseBannerEnter: 'MARKET RESEARCH',
    phaseBannerFrom: {
      data_structurer: 'Product Strategy → Research',
    },
  },
  {
    agentName: 'brand_designer',
    characterId: 'blueprint',
    displayName: 'Juno Park · Creative Director',
    outputKey: 'brand',
    phaseBannerEnter: 'BRAND',
    phaseBannerFrom: {
      market_analyst: 'Research Complete → Brand',
    },
  },
  {
    agentName: 'business_planner',
    characterId: 'business-planner',
    displayName: 'Eloise Harper · COO',
    outputKey: 'business_plan',
    phaseBannerEnter: 'OPERATING PLAN',
    phaseBannerFrom: {
      brand_designer: 'Brand Complete → Operating Plan',
      market_analyst: 'Research Complete → Operating Plan',
    },
  },
  {
    agentName: 'strategist',
    characterId: 'strategist',
    displayName: 'Yara Solas · Chief Strategist',
    outputKey: 'lean_canvas',
    phaseBannerEnter: 'LEAN CANVAS',
    phaseBannerFrom: {
      business_planner: 'Operating Plan → Canvas',
    },
  },
  {
    agentName: 'cto',
    characterId: 'cto',
    displayName: 'Sam Reyes · CTO',
    outputKey: 'build_plan',
    phaseBannerEnter: 'BUILD PLAN',
    phaseBannerFrom: {
      strategist: 'Canvas Sealed → Build Plan',
      business_planner: 'Operating Plan → Build Plan',
      reviewer: 'Revising Build Plan',
      ceo: 'CEO Sent Back → Build Plan',
    },
  },
  {
    agentName: 'reviewer',
    characterId: 'reviewer',
    displayName: 'Aditi Rao · Chief of Staff',
    outputKey: 'plan_review',
    phaseBannerFrom: {
      cto: 'Reviewing Build Plan',
    },
  },

  // Factory subagents (Claude Agent SDK). Each maps deterministically to a
  // FACTORY_CHARACTERS sprite so the Pixi scene shows the right persona for
  // each role — no round-robin guessing.
  {
    agentName: 'architect',
    characterId: 'lead-dev',
    displayName: 'Kai Ingram · Lead Architect',
  },
  {
    agentName: 'implementer',
    characterId: 'explorer',
    displayName: 'Lina Torres · Senior Engineer',
  },
  {
    agentName: 'tester',
    characterId: 'qa',
    displayName: 'Priya Shah · Quality Lead',
  },
  {
    agentName: 'devops',
    characterId: 'devops',
    displayName: 'Rafi Nassar · DevOps',
  },
  {
    agentName: 'build_reviewer',
    characterId: 'supervisor',
    displayName: 'Max Bauer · Engineering Manager',
  },
  {
    agentName: 'factory',
    characterId: 'supervisor',
    displayName: 'Max Bauer · Factory Supervisor',
  },
] as const;

// ---------------------------------------------------------------------------
// Derived lookup maps — computed once at module load
// ---------------------------------------------------------------------------

/** ADK agent name → character ID */
export const AGENT_TO_CHARACTER: Record<string, string> = Object.fromEntries(
  AGENT_REGISTRY.map((a) => [a.agentName, a.characterId]),
);

/** ADK output_key → character ID */
export const OUTPUT_KEY_TO_CHARACTER: Record<string, string> = Object.fromEntries(
  AGENT_REGISTRY.filter((a) => a.outputKey).map((a) => [a.outputKey!, a.characterId]),
);

/** ADK agent name → human-readable display name */
export const AGENT_DISPLAY_NAMES: Record<string, string> = Object.fromEntries(
  AGENT_REGISTRY.map((a) => [a.agentName, a.displayName]),
);

/** Agent transition banners: agentName → { prevAgent → banner } */
export const PHASE_BANNERS: Record<string, Record<string, string>> = Object.fromEntries(
  AGENT_REGISTRY.map((a) => {
    const map: Record<string, string> = {};
    if (a.phaseBannerEnter) map['_enter'] = a.phaseBannerEnter;
    if (a.phaseBannerFrom) Object.assign(map, a.phaseBannerFrom);
    return [a.agentName, map];
  }).filter(([, map]) => Object.keys(map as Record<string, string>).length > 0),
);
