/**
 * Canonical tool name constants used across the frontend.
 *
 * Single source of truth: zones, tool indicators, and activity logs
 * all reference these constants instead of duplicating string literals.
 */

// --- Boardroom tools (orchestrator) ---
export const TOOL_WEB_SEARCH = 'web_search' as const;
export const TOOL_GOOGLE_SEARCH = 'GoogleSearch' as const;
export const TOOL_SEARCH = 'search' as const;
export const TOOL_GENERATE_ARTIFACTS = 'generate_artifacts' as const;
export const TOOL_DELEGATE_TO_FACTORY = 'start_factory' as const;
export const TOOL_GENERATE_TASK_STEPS = 'generate_task_steps' as const;

// --- Factory tools (build runner) ---
export const TOOL_WRITE = 'Write' as const;
export const TOOL_EDIT = 'Edit' as const;
export const TOOL_READ = 'Read' as const;
export const TOOL_GREP = 'Grep' as const;
export const TOOL_BASH = 'Bash' as const;

// --- Additional orchestrator tools ---
export const TOOL_SEARCH_WEB = 'search_web' as const;
export const TOOL_GENERATE_ARCHITECTURE = 'generate_architecture' as const;
export const TOOL_ANALYZE_MARKET = 'analyze_market' as const;
export const TOOL_STRUCTURE_DATA = 'structure_data' as const;

/** Short uppercase labels for the pixi ToolIndicator bubble. */
export const TOOL_SHORT_LABELS: Record<string, string> = {
  [TOOL_WEB_SEARCH]: 'SEARCH',
  [TOOL_GOOGLE_SEARCH]: 'SEARCH',
  [TOOL_SEARCH]: 'SEARCH',
  [TOOL_WRITE]: 'WRITE',
  [TOOL_EDIT]: 'EDIT',
  [TOOL_READ]: 'READ',
  [TOOL_GREP]: 'GREP',
  [TOOL_BASH]: 'BASH',
  [TOOL_DELEGATE_TO_FACTORY]: 'SEND',
  [TOOL_GENERATE_ARTIFACTS]: 'GEN',
  [TOOL_GENERATE_TASK_STEPS]: 'PLAN',
};

/** Human-readable prose labels for the activity log. */
export const TOOL_PROSE_LABELS: Record<string, string> = {
  [TOOL_WEB_SEARCH]: 'searching the web',
  [TOOL_SEARCH_WEB]: 'searching the web',
  [TOOL_DELEGATE_TO_FACTORY]: 'handing off to Factory',
  [TOOL_GENERATE_ARCHITECTURE]: 'designing the architecture',
  [TOOL_ANALYZE_MARKET]: 'analyzing the market',
  [TOOL_STRUCTURE_DATA]: 'structuring the data',
};
