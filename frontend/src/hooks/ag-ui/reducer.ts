/**
 * AG-UI reducer — pure semantic state transitions.
 *
 * No spatial/coordinate logic — that lives in the pixi layer.
 */

import type { StartupCharacter } from '../../data/startup-characters';
import type { AgentState, BoardState, AgUiState } from './types';

// ---------------------------------------------------------------------------
// Reducer actions
// ---------------------------------------------------------------------------

export type Action =
  | { type: 'RUN_STARTED' }
  | { type: 'TEXT_MESSAGE_CONTENT'; agentId: string; content: string }
  | { type: 'TOOL_CALL_START'; agentId: string; toolName: string }
  | { type: 'TOOL_CALL_END'; agentId: string }
  | { type: 'STATE_DELTA'; delta: Array<{ op: string; path: string; value?: unknown }> }
  | { type: 'STATE_SNAPSHOT'; snapshot: Record<string, unknown> }
  | { type: 'RUN_FINISHED' }
  | { type: 'RUN_ERROR'; error: string }
  | { type: 'CLEAR_SPEECH'; agentId: string }
  | { type: 'THOUGHT_BUBBLE'; agentId: string; text: string }
  | {
      type: 'AGENT_HANDOFF';
      fromId: string | null;
      toId: string;
      fromRawName?: string | null;
      toRawName?: string;
    };

// ---------------------------------------------------------------------------
// Agent helpers
// ---------------------------------------------------------------------------

export function createInitialAgents(
  characters: readonly StartupCharacter[],
): Map<string, AgentState> {
  const map = new Map<string, AgentState>();
  for (const char of characters) {
    map.set(char.id, {
      characterId: char.id,
      currentTool: null,
      isThinking: false,
      isSpeaking: false,
      speechBubble: null,
      handoffPeer: null,
    });
  }
  return map;
}

export function cloneAgents(agents: Map<string, AgentState>): Map<string, AgentState> {
  return new Map(agents);
}

export function updateAgent(
  agents: Map<string, AgentState>,
  id: string,
  patch: Partial<AgentState>,
): Map<string, AgentState> {
  const existing = agents.get(id);
  if (!existing) return agents;
  const next = cloneAgents(agents);
  next.set(id, { ...existing, ...patch });
  return next;
}

export function applyJsonPatch(
  state: BoardState,
  delta: Array<{ op: string; path: string; value?: unknown }>,
): BoardState {
  const next = { ...state };
  for (const op of delta) {
    const key = op.path.replace(/^\//, '').split('/')[0];
    if (op.op === 'add' || op.op === 'replace') {
      next[key] = op.value;
    } else if (op.op === 'remove') {
      delete next[key];
    }
  }
  return next;
}

// ---------------------------------------------------------------------------
// Reducer factory
// ---------------------------------------------------------------------------

export function createReducer(
  characters: readonly StartupCharacter[],
) {
  // Closure-captured lookup so AGENT_HANDOFF can seed each agent's bubble
  // with its default thinking summary without plumbing it through actions.
  const thinkingSummaries = new Map<string, string>(
    characters
      .filter((c) => c.thinkingSummary)
      .map((c) => [c.id, c.thinkingSummary!] as const),
  );

  const initialState: AgUiState = {
    agents: createInitialAgents(characters),
    boardState: {},
    celebration: false,
    error: null,
  };

  function reducer(state: AgUiState, action: Action): AgUiState {
    switch (action.type) {
      case 'RUN_STARTED': {
        const agents = createInitialAgents(characters);
        const visionary = agents.get('visionary');
        if (visionary) {
          const summary = thinkingSummaries.get('visionary');
          agents.set('visionary', {
            ...visionary,
            isThinking: true,
            // Seed a bubble so the screen isn't silent before the first
            // active_agent delta arrives.
            ...(summary ? { speechBubble: summary, isSpeaking: true } : {}),
          });
        }
        return { ...state, agents, boardState: {}, celebration: false, error: null };
      }

      case 'TEXT_MESSAGE_CONTENT': {
        const existing = state.agents.get(action.agentId);
        if (!existing) return state;
        const bubble = (existing.speechBubble ?? '') + action.content;
        return {
          ...state,
          agents: updateAgent(state.agents, action.agentId, {
            speechBubble: bubble,
            isSpeaking: true,
          }),
        };
      }

      case 'TOOL_CALL_START': {
        const existing = state.agents.get(action.agentId);
        if (!existing) return state;
        // Starting a tool ends any in-flight handoff: clear the receiver's
        // handoffPeer so it walks to the tool zone, and clear the sender's
        // so it can return to its idle position.
        let agents = updateAgent(state.agents, action.agentId, {
          currentTool: action.toolName,
          isThinking: false,
          handoffPeer: null,
        });
        if (existing.handoffPeer) {
          agents = updateAgent(agents, existing.handoffPeer, {
            handoffPeer: null,
          });
        }
        return { ...state, agents };
      }

      case 'TOOL_CALL_END': {
        const existing = state.agents.get(action.agentId);
        if (!existing) return state;
        return {
          ...state,
          agents: updateAgent(state.agents, action.agentId, {
            currentTool: null,
          }),
        };
      }

      case 'STATE_DELTA': {
        return {
          ...state,
          boardState: applyJsonPatch(state.boardState, action.delta),
        };
      }

      case 'STATE_SNAPSHOT': {
        return {
          ...state,
          agents: createInitialAgents(characters),
          boardState: action.snapshot as BoardState,
        };
      }

      case 'RUN_FINISHED': {
        const agents = cloneAgents(state.agents);
        for (const char of characters) {
          const existing = agents.get(char.id);
          if (existing) {
            agents.set(char.id, {
              ...existing,
              isThinking: false,
              isSpeaking: false,
              speechBubble: null,
              currentTool: null,
              handoffPeer: null,
            });
          }
        }
        return { ...state, agents, celebration: true };
      }

      case 'RUN_ERROR': {
        return { ...state, error: action.error };
      }

      case 'CLEAR_SPEECH': {
        return {
          ...state,
          agents: updateAgent(state.agents, action.agentId, {
            speechBubble: null,
            isSpeaking: false,
          }),
        };
      }

      case 'THOUGHT_BUBBLE': {
        const existing = state.agents.get(action.agentId);
        if (!existing) return state;
        return {
          ...state,
          agents: updateAgent(state.agents, action.agentId, {
            speechBubble: action.text,
            isSpeaking: true,
            isThinking: false,
          }),
        };
      }

      case 'AGENT_HANDOFF': {
        let agents = state.agents;

        // Clear any stale back-references before installing the new pair.
        // If fromId was previously partnered with someone else (a chained
        // handoff where the intermediate agent never called a tool), that
        // stale peer would otherwise keep walking to the meet point forever.
        const clearStale = (id: string, newPartner: string | null) => {
          const existing = agents.get(id);
          const prev = existing?.handoffPeer ?? null;
          if (prev && prev !== newPartner) {
            const other = agents.get(prev);
            if (other?.handoffPeer === id) {
              agents = updateAgent(agents, prev, { handoffPeer: null });
            }
          }
        };
        if (action.fromId) clearStale(action.fromId, action.toId);
        clearStale(action.toId, action.fromId);

        // Carry the outgoing agent's last thought bubble forward so the
        // incoming agent (often the CEO, which has no structured output of
        // its own) can echo the specialist's just-produced thought. This
        // keeps all bubble text sourced from structured output rather than
        // hardcoded strings.
        const carryForwardBubble = action.fromId
          ? state.agents.get(action.fromId)?.speechBubble ?? null
          : null;

        if (action.fromId) {
          agents = updateAgent(agents, action.fromId, {
            isThinking: false,
            isSpeaking: false,
            speechBubble: null,
            // Clear any stale tool indicator — backends occasionally drop
            // TOOL_CALL_END when control snaps to another agent, which would
            // otherwise leave the spotlight pinned to a phantom tool.
            currentTool: null,
            handoffPeer: action.toId,
          });
        }

        const summary = thinkingSummaries.get(action.toId);
        agents = updateAgent(agents, action.toId, {
          isThinking: true,
          handoffPeer: action.fromId,
          // Prefer the carried-forward bubble (real structured-output text
          // from the previous agent) over any hardcoded default. Real
          // thought_bubble for the incoming agent replaces it once it streams.
          ...(carryForwardBubble
            ? { speechBubble: carryForwardBubble, isSpeaking: true }
            : summary
              ? { speechBubble: summary, isSpeaking: true }
              : {}),
        });

        return { ...state, agents };
      }

      default:
        return state;
    }
  }

  return { reducer, initialState };
}
