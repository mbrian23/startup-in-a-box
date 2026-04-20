/**
 * AG-UI public types — extracted from useAgUiEvents for SRP.
 *
 * AgentState is purely semantic — no spatial/coordinate data.
 * Spatial concerns (position, orientation, movement) live in the pixi layer.
 */

// ---------------------------------------------------------------------------
// Agent state (semantic only — no coordinates)
// ---------------------------------------------------------------------------

export interface AgentState {
  readonly characterId: string;
  currentTool: string | null;
  isThinking: boolean;
  isSpeaking: boolean;
  speechBubble: string | null;
  handoffPeer: string | null;  // characterId of handoff partner
}

// ---------------------------------------------------------------------------
// Board state — typed accessors rely on known keys (Finding 6: LSP)
// ---------------------------------------------------------------------------

export interface LeanCanvasBlock {
  headline: string;
  bullets: string[];
}

export interface LeanCanvas {
  thought_bubble?: string;
  problem: LeanCanvasBlock;
  customer_segments: LeanCanvasBlock;
  unique_value_proposition: LeanCanvasBlock;
  solution: LeanCanvasBlock;
  channels: LeanCanvasBlock;
  revenue_streams: LeanCanvasBlock;
  cost_structure: LeanCanvasBlock;
  key_metrics: LeanCanvasBlock;
  unfair_advantage: LeanCanvasBlock;
}

export interface FactoryUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

export interface FactoryRateLimit {
  status?: string;
  resets_at?: string | null;
  message?: string;
}

export interface BoardState {
  active_agent?: string;
  handoff_stage?: string;
  power_state?: string;
  factory_progress?: number;
  deployment_url?: string;
  github_url?: string;
  hitl_pending?: boolean;
  hitl?: HITLState;
  lean_canvas?: LeanCanvas;
  // Factory run accounting — populated from Claude Agent SDK ResultMessage.
  cost_usd?: number;
  usage?: FactoryUsage;
  num_turns?: number;
  duration_ms?: number;
  // Rate-limit hint emitted when the SDK throttles mid-run.
  rate_limit?: FactoryRateLimit;
  // Most recent non-empty CLI stderr line — lets the UI show a live
  // warning feed instead of waiting for the post-mortem classifier.
  cli_stderr_line?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Aggregate UI state
// ---------------------------------------------------------------------------

export interface AgUiState {
  agents: Map<string, AgentState>;
  boardState: BoardState;
  celebration: boolean;
  error: string | null;
}

// ---------------------------------------------------------------------------
// AG-UI event types — discriminated union (Finding 8: ISP)
// ---------------------------------------------------------------------------

export type AgUiEventType =
  | 'RUN_STARTED'
  | 'TEXT_MESSAGE_START'
  | 'TEXT_MESSAGE_CONTENT'
  | 'TEXT_MESSAGE_END'
  | 'TOOL_CALL_START'
  | 'TOOL_CALL_ARGS'
  | 'TOOL_CALL_END'
  | 'STATE_DELTA'
  | 'STATE_SNAPSHOT'
  | 'RUN_FINISHED'
  | 'RUN_ERROR';

interface RunStartedEvent {
  type: 'RUN_STARTED';
}

interface TextMessageStartEvent {
  type: 'TEXT_MESSAGE_START';
  name?: string;
  messageId?: string;
  agentId?: string;
}

interface TextMessageContentEvent {
  type: 'TEXT_MESSAGE_CONTENT';
  content?: string;
  messageId?: string;
  agentId?: string;
  name?: string;
}

interface TextMessageEndEvent {
  type: 'TEXT_MESSAGE_END';
  messageId?: string;
  agentId?: string;
}

interface ToolCallStartEvent {
  type: 'TOOL_CALL_START';
  toolName?: string;
  toolCallId?: string;
  toolCallArgs?: Record<string, unknown>;
  agentId?: string;
}

interface ToolCallArgsEvent {
  type: 'TOOL_CALL_ARGS';
  toolCallId?: string;
  delta?: string;
  agentId?: string;
}

interface ToolCallEndEvent {
  type: 'TOOL_CALL_END';
  toolCallId?: string;
  agentId?: string;
}

interface StateDeltaEvent {
  type: 'STATE_DELTA';
  delta?: Array<{ op: string; path: string; value?: unknown }>;
}

interface StateSnapshotEvent {
  type: 'STATE_SNAPSHOT';
  snapshot?: Record<string, unknown>;
}

interface RunFinishedEvent {
  type: 'RUN_FINISHED';
}

interface RunErrorEvent {
  type: 'RUN_ERROR';
  error?: string;
}

export type AgUiEvent =
  | RunStartedEvent
  | TextMessageStartEvent
  | TextMessageContentEvent
  | TextMessageEndEvent
  | ToolCallStartEvent
  | ToolCallArgsEvent
  | ToolCallEndEvent
  | StateDeltaEvent
  | StateSnapshotEvent
  | RunFinishedEvent
  | RunErrorEvent;

// ---------------------------------------------------------------------------
// Event source interface (DIP)
// ---------------------------------------------------------------------------

export interface AgUiEventSource {
  subscribe: (handler: (event: AgUiEvent) => void) => (() => void) | void;
}

// ---------------------------------------------------------------------------
// HITL (human-in-the-loop) approval gate
// ---------------------------------------------------------------------------

export interface HITLBuildStep {
  id?: string;
  title?: string;
  description?: string;
}

export interface HITLBuildPlan {
  summary?: string;
  tech_stack?: string;
  steps?: HITLBuildStep[];
}

export interface HITLState {
  status: 'awaiting' | 'approved' | 'rejected';
  build_plan?: HITLBuildPlan;
}
