/**
 * Tracks agent execution segments for timeline visualization.
 * Each segment = one agent's active period with start/end timestamps.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AgUiEvent, AgUiEventSource } from './useAgUiEvents';
import { AGENT_DISPLAY_NAMES } from '../data/agent-registry';

export interface TimelineSegment {
  agent: string;
  displayName: string;
  startMs: number;
  endMs: number | null; // null = still running
  tools: string[];
}

export interface ExecutionTimelineState {
  segments: TimelineSegment[];
  runStartMs: number | null;
  runEndMs: number | null;
}

const INITIAL: ExecutionTimelineState = {
  segments: [],
  runStartMs: null,
  runEndMs: null,
};

export function useExecutionTimeline(eventSource: AgUiEventSource): ExecutionTimelineState {
  const [state, setState] = useState<ExecutionTimelineState>(INITIAL);
  const currentAgent = useRef<string | null>(null);

  const handler = useCallback((event: AgUiEvent) => {
    const now = Date.now();

    switch (event.type) {
      case 'RUN_STARTED':
        currentAgent.current = null;
        setState({ segments: [], runStartMs: now, runEndMs: null });
        break;

      case 'STATE_DELTA':
        if (event.delta) {
          for (const op of event.delta) {
            if (op.path === '/active_agent' && typeof op.value === 'string') {
              const newAgent = op.value;
              if (newAgent === currentAgent.current) break;

              setState((prev) => {
                const segments = [...prev.segments];
                // Close previous segment
                if (currentAgent.current && segments.length > 0) {
                  const last = segments[segments.length - 1];
                  if (last.agent === currentAgent.current && last.endMs === null) {
                    segments[segments.length - 1] = { ...last, endMs: now };
                  }
                }
                // Open new segment
                segments.push({
                  agent: newAgent,
                  displayName: AGENT_DISPLAY_NAMES[newAgent] ?? newAgent,
                  startMs: now,
                  endMs: null,
                  tools: [],
                });
                currentAgent.current = newAgent;
                return { ...prev, segments };
              });
            }
          }
        }
        break;

      case 'TOOL_CALL_START':
        if (event.toolName) {
          setState((prev) => {
            const segments = [...prev.segments];
            if (segments.length > 0) {
              const last = segments[segments.length - 1];
              if (!last.tools.includes(event.toolName!)) {
                segments[segments.length - 1] = {
                  ...last,
                  tools: [...last.tools, event.toolName!],
                };
              }
            }
            return { ...prev, segments };
          });
        }
        break;

      case 'RUN_FINISHED':
      case 'RUN_ERROR':
        setState((prev) => {
          const segments = [...prev.segments];
          if (segments.length > 0) {
            const last = segments[segments.length - 1];
            if (last.endMs === null) {
              segments[segments.length - 1] = { ...last, endMs: now };
            }
          }
          currentAgent.current = null;
          return { ...prev, segments, runEndMs: now };
        });
        break;
    }
  }, []);

  useEffect(() => {
    const unsub = eventSource.subscribe(handler);
    return () => { unsub?.(); };
  }, [eventSource, handler]);

  return state;
}
