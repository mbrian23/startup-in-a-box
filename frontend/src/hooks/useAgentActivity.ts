/**
 * Lightweight hook that subscribes to the orchestrator event source
 * and tracks high-level agent activity for the sidebar indicators.
 */

import { useEffect, useReducer, useCallback, useState } from 'react';
import type { AgUiEvent, AgUiEventSource } from './useAgUiEvents';
import { AGENT_DISPLAY_NAMES, PHASE_BANNERS } from '../data/agent-registry';
import { TOOL_DELEGATE_TO_FACTORY, TOOL_PROSE_LABELS } from '../data/tool-names';

export type AgentPhase = 'idle' | 'thinking' | 'researching' | 'building' | 'complete' | 'error';

export interface AgentActivity {
  phase: AgentPhase;
  activeAgent: string | null;
  activeAgentDisplay: string | null;
  isRunning: boolean;
  recentLog: string[];
  /** Brief text for phase transition banner (e.g., "Strategy → Research") */
  phaseBanner: string | null;
  /** Populated when the pipeline fails — surfaced by PipelineErrorOverlay. */
  errorMessage: string | null;
}

type Action =
  | { type: 'RESET' }
  | { type: 'RUN_STARTED' }
  | { type: 'ACTIVE_AGENT'; agent: string }
  | { type: 'TOOL_START'; toolName: string; agent: string | null }
  | { type: 'TOOL_END' }
  | { type: 'TEXT_CONTENT'; agent: string | null }
  | { type: 'RUN_FINISHED' }
  | { type: 'RUN_ERROR'; error: string };

const INITIAL: AgentActivity = {
  phase: 'idle',
  activeAgent: null,
  activeAgentDisplay: null,
  isRunning: false,
  recentLog: [],
  phaseBanner: null,
  errorMessage: null,
};

function displayName(agent: string | null): string | null {
  if (!agent) return null;
  return AGENT_DISPLAY_NAMES[agent] ?? agent;
}

function toolLabel(toolName: string): string {
  return TOOL_PROSE_LABELS[toolName] ?? `using ${toolName.replace(/_/g, ' ')}`;
}

function addLog(logs: string[], entry: string): string[] {
  const next = [entry, ...logs];
  return next.slice(0, 8);
}

function reducer(state: AgentActivity, action: Action): AgentActivity {
  switch (action.type) {
    case 'RESET':
      return INITIAL;

    case 'RUN_STARTED':
      return {
        ...INITIAL,
        phase: 'thinking',
        isRunning: true,
        recentLog: addLog([], 'Pipeline started'),
      };

    case 'ACTIVE_AGENT': {
      const name = displayName(action.agent);
      const bannerMap = PHASE_BANNERS[action.agent];
      const banner = bannerMap?.[state.activeAgent ?? ''] ?? bannerMap?.['_enter'] ?? null;
      return {
        ...state,
        activeAgent: action.agent,
        activeAgentDisplay: name,
        phase: 'thinking',
        phaseBanner: banner,
        recentLog: addLog(state.recentLog, `${name} is thinking...`),
      };
    }

    case 'TOOL_START': {
      const name = displayName(action.agent ?? state.activeAgent);
      const label = toolLabel(action.toolName);
      const phase: AgentPhase =
        action.toolName === TOOL_DELEGATE_TO_FACTORY ? 'building' : 'researching';
      const banner = action.toolName === TOOL_DELEGATE_TO_FACTORY
        ? 'Handing Off to Factory...'
        : null;
      return {
        ...state,
        phase,
        phaseBanner: banner ?? state.phaseBanner,
        recentLog: addLog(
          state.recentLog,
          name ? `${name} is ${label}...` : `Agent is ${label}...`,
        ),
      };
    }

    case 'TOOL_END':
      return {
        ...state,
        phase: state.isRunning ? 'thinking' : state.phase,
      };

    case 'TEXT_CONTENT': {
      const name = displayName(action.agent ?? state.activeAgent);
      if (state.phase !== 'thinking') return state;
      return {
        ...state,
        recentLog:
          state.recentLog[0]?.includes('is speaking')
            ? state.recentLog
            : addLog(state.recentLog, name ? `${name} is speaking...` : 'Agent is speaking...'),
      };
    }

    case 'RUN_FINISHED':
      return {
        ...state,
        phase: 'complete',
        isRunning: false,
        activeAgent: null,
        activeAgentDisplay: null,
        phaseBanner: 'Pipeline Complete!',
        recentLog: addLog(state.recentLog, 'Pipeline complete!'),
      };

    case 'RUN_ERROR':
      return {
        ...state,
        phase: 'error',
        isRunning: false,
        errorMessage: action.error,
        recentLog: addLog(state.recentLog, `Error: ${action.error}`),
      };

    default:
      return state;
  }
}

export function useAgentActivity(
  eventSource: AgUiEventSource,
  resetKey?: string,
): AgentActivity {
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const [prevResetKey, setPrevResetKey] = useState(resetKey);

  // Render-phase reset on resetKey change — React discards the in-progress
  // render and restarts from the initial state, avoiding a setState-in-effect
  // cascade.
  if (prevResetKey !== resetKey) {
    setPrevResetKey(resetKey);
    dispatch({ type: 'RESET' });
  }

  const handler = useCallback((event: AgUiEvent) => {
    switch (event.type) {
      case 'RUN_STARTED':
        dispatch({ type: 'RUN_STARTED' });
        break;

      case 'STATE_DELTA':
        if (event.delta) {
          for (const op of event.delta) {
            if (op.path === '/active_agent' && typeof op.value === 'string') {
              dispatch({ type: 'ACTIVE_AGENT', agent: op.value });
            }
          }
        }
        break;

      case 'TOOL_CALL_START':
        dispatch({
          type: 'TOOL_START',
          toolName: event.toolName ?? '',
          agent: event.agentId ?? null,
        });
        break;

      case 'TOOL_CALL_END':
        dispatch({ type: 'TOOL_END' });
        break;

      case 'TEXT_MESSAGE_CONTENT':
        dispatch({ type: 'TEXT_CONTENT', agent: event.agentId ?? event.name ?? null });
        break;

      case 'RUN_FINISHED':
        dispatch({ type: 'RUN_FINISHED' });
        break;

      case 'RUN_ERROR':
        dispatch({ type: 'RUN_ERROR', error: event.error ?? 'Unknown error' });
        break;
    }
  }, []);

  useEffect(() => {
    const unsub = eventSource.subscribe(handler);
    return () => { unsub?.(); };
  }, [eventSource, handler]);

  return state;
}
