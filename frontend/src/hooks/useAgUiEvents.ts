/**
 * AG-UI event consumer hook.
 *
 * Pure event -> state. No rendering, no fetch calls, no side effects beyond
 * React state. Event source and zones table are injected (DIP).
 */

import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import type { StartupCharacter } from '../data/startup-characters';
import { AGENT_TO_CHARACTER, OUTPUT_KEY_TO_CHARACTER } from '../data/agent-registry';
import { createReducer } from './ag-ui/reducer';
import type { AgUiEvent } from './ag-ui/types';

// ---------------------------------------------------------------------------
// Re-exports — backward compatibility for all existing import sites
// ---------------------------------------------------------------------------

export type {
  BoardState,
  AgUiState,
  AgUiEvent,
  AgUiEventType,
  AgUiEventSource,
} from './ag-ui/types';

export { createReducer } from './ag-ui/reducer';

export {
  readHandoffStage,
  readPowerState,
  readFactoryProgress,
  readDeploymentUrl,
  readGithubUrl,
} from './ag-ui/accessors';

// ---------------------------------------------------------------------------
// Re-export agent maps (formerly defined here)
// ---------------------------------------------------------------------------

export { AGENT_TO_CHARACTER as DEFAULT_AGENT_MAP, OUTPUT_KEY_TO_CHARACTER } from '../data/agent-registry';

// ---------------------------------------------------------------------------
// The hook
// ---------------------------------------------------------------------------

import type { AgUiEventSource } from './ag-ui/types';

export function useAgUiEvents(
  eventSource: AgUiEventSource | null,
  characters: readonly StartupCharacter[],
  agentMap?: Record<string, string>,
) {
  const { reducer, initialState } = useMemo(
    () => createReducer(characters),
    [characters],
  );

  const [state, dispatch] = useReducer(reducer, initialState);

  // Speech bubble auto-clear timers
  const speechTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const clearSpeechAfterDelay = useCallback((agentId: string, textLength = 0) => {
    const revealMs = (textLength / 2) * 30;
    const readMs = 3500 + textLength * 55;
    const delay = Math.min(revealMs + readMs, 18000);
    const timers = speechTimers.current;
    const existing = timers.get(agentId);
    if (existing) clearTimeout(existing);
    timers.set(
      agentId,
      setTimeout(() => {
        dispatch({ type: 'CLEAR_SPEECH', agentId });
        timers.delete(agentId);
      }, delay),
    );
  }, []);

  // Accumulate tool-call argument JSON fragments per toolCallId so we can
  // surface `ceo_quip` the moment it appears in the stream.
  const toolArgsBuffer = useRef(new Map<string, { buf: string; callerCharId: string; quipEmitted: boolean }>());

  // Debounce STATE_DELTA at 16ms
  const pendingDelta = useRef<Array<{ op: string; path: string; value?: unknown }>>([]);
  const deltaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushDelta = useCallback(() => {
    if (pendingDelta.current.length > 0) {
      dispatch({ type: 'STATE_DELTA', delta: pendingDelta.current });
      pendingDelta.current = [];
    }
    deltaTimer.current = null;
  }, []);

  // Track active agent from STATE_DELTA so the reducer can resolve it
  const activeAgentRef = useRef<string | null>(null);

  // Dynamic agent->character assignment for unknown agents (round-robin)
  const dynamicMapRef = useRef(new Map<string, string>());
  const nextCharIdx = useRef(0);

  const mergedMap = agentMap
    ? { ...AGENT_TO_CHARACTER, ...agentMap }
    : AGENT_TO_CHARACTER;

  // Resolve agentId -- checks explicit map first, then dynamic assignment
  const resolveAgent = useCallback(
    (agentId?: string): string => {
      if (agentId && characters.some((c) => c.id === agentId)) {
        return agentId;
      }

      const rawId = agentId || activeAgentRef.current;
      if (!rawId) return characters[0]?.id ?? 'unknown';

      if (mergedMap[rawId]) return mergedMap[rawId];

      if (dynamicMapRef.current.has(rawId)) {
        return dynamicMapRef.current.get(rawId)!;
      }

      const charId = characters[nextCharIdx.current % characters.length]?.id;
      if (charId) {
        dynamicMapRef.current.set(rawId, charId);
        nextCharIdx.current++;
      }
      return charId ?? characters[0]?.id ?? 'unknown';
    },
    [characters, mergedMap],
  );

  useEffect(() => {
    if (!eventSource || typeof eventSource.subscribe !== 'function') return;

    const unsubscribe = eventSource.subscribe((event: AgUiEvent) => {
      switch (event.type) {
        case 'RUN_STARTED':
          activeAgentRef.current = null;
          dispatch({ type: 'RUN_STARTED' });
          break;

        case 'TEXT_MESSAGE_START':
          if (event.name) {
            activeAgentRef.current = event.name;
          }
          break;

        case 'TEXT_MESSAGE_CONTENT': {
          const agentId = resolveAgent(event.agentId ?? event.name);
          const hasStructuredOutput = Object.values(OUTPUT_KEY_TO_CHARACTER).includes(agentId);
          if (!hasStructuredOutput) {
            const content = event.content ?? '';
            dispatch({ type: 'TEXT_MESSAGE_CONTENT', agentId, content });
            clearSpeechAfterDelay(agentId, content.length);
          }
          break;
        }

        case 'TOOL_CALL_START': {
          const callerCharId = resolveAgent(event.agentId);
          dispatch({
            type: 'TOOL_CALL_START',
            agentId: callerCharId,
            toolName: event.toolName ?? '',
          });
          if (event.toolCallId) {
            toolArgsBuffer.current.set(event.toolCallId, {
              buf: '',
              callerCharId,
              quipEmitted: false,
            });
          }
          break;
        }

        case 'TOOL_CALL_ARGS': {
          if (!event.toolCallId || typeof event.delta !== 'string') break;
          const entry = toolArgsBuffer.current.get(event.toolCallId);
          if (!entry || entry.quipEmitted) break;
          entry.buf += event.delta;
          const match = entry.buf.match(
            /"ceo_quip"\s*:\s*"((?:\\.|[^"\\])*)"/,
          );
          if (match) {
            const quip = match[1].replace(/\\"/g, '"').replace(/\\n/g, ' ').trim();
            if (quip) {
              dispatch({
                type: 'THOUGHT_BUBBLE',
                agentId: entry.callerCharId,
                text: quip,
              });
              clearSpeechAfterDelay(entry.callerCharId, quip.length);
              entry.quipEmitted = true;
            }
          }
          break;
        }

        case 'TOOL_CALL_END':
          if (event.toolCallId) {
            toolArgsBuffer.current.delete(event.toolCallId);
          }
          dispatch({
            type: 'TOOL_CALL_END',
            agentId: resolveAgent(event.agentId),
          });
          break;

        case 'STATE_DELTA': {
          if (!event.delta) break;
          for (const op of event.delta) {
            if (op.path === '/active_agent' && typeof op.value === 'string') {
              const prevAgent = activeAgentRef.current;
              const newAgent = op.value as string;
              activeAgentRef.current = newAgent;

              const prevCharId = prevAgent ? resolveAgent(prevAgent) : null;
              const newCharId = resolveAgent(newAgent);

              if (newCharId !== prevCharId) {
                dispatch({
                  type: 'AGENT_HANDOFF',
                  fromId: prevCharId,
                  toId: newCharId,
                });
              }
            }
            if ((op.op === 'add' || op.op === 'replace') && op.value && typeof op.value === 'object') {
              const key = op.path.replace(/^\//, '').split('/')[0];
              const charId = OUTPUT_KEY_TO_CHARACTER[key];
              const val = op.value as Record<string, unknown>;
              if (charId && typeof val.thought_bubble === 'string') {
                dispatch({ type: 'THOUGHT_BUBBLE', agentId: charId, text: val.thought_bubble });
                clearSpeechAfterDelay(charId, val.thought_bubble.length);
              }
            }
          }
          pendingDelta.current.push(...event.delta);
          if (!deltaTimer.current) {
            deltaTimer.current = setTimeout(flushDelta, 16);
          }
          break;
        }

        case 'STATE_SNAPSHOT':
          dispatch({ type: 'STATE_SNAPSHOT', snapshot: event.snapshot ?? {} });
          break;

        case 'RUN_FINISHED':
          dispatch({ type: 'RUN_FINISHED' });
          break;

        case 'RUN_ERROR':
          dispatch({ type: 'RUN_ERROR', error: event.error ?? 'Unknown error' });
          break;
      }
    });

    return () => {
      unsubscribe?.();
      for (const timer of speechTimers.current.values()) clearTimeout(timer);
      speechTimers.current.clear();
      if (deltaTimer.current) clearTimeout(deltaTimer.current);
    };
  }, [eventSource, resolveAgent, clearSpeechAfterDelay, flushDelta]);

  return state;
}
