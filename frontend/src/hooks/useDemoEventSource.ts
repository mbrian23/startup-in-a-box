/**
 * Client-side demo event player with dynamic speed and pause.
 *
 * Loads the full JSONL fixture into memory, then replays events with
 * setTimeout chains that read the current speed/paused state on each
 * tick. Speed and pause can be changed mid-replay.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AgUiEvent, AgUiEventSource, AgUiEventType } from './ag-ui/types';

const VALID_TYPES = new Set<string>([
  'RUN_STARTED', 'TEXT_MESSAGE_CONTENT', 'TOOL_CALL_START', 'TOOL_CALL_ARGS', 'TOOL_CALL_END',
  'STATE_DELTA', 'STATE_SNAPSHOT', 'RUN_FINISHED', 'RUN_ERROR',
  'TEXT_MESSAGE_START', 'TEXT_MESSAGE_END',
]);

interface FixtureEntry {
  delay_ms: number;
  event: Record<string, unknown>;
}

function parseEvent(obj: Record<string, unknown>): AgUiEvent | null {
  if (!obj.type || !VALID_TYPES.has(obj.type as string)) return null;

  const base: Record<string, unknown> = { type: obj.type as AgUiEventType };

  if (obj.agentId) base.agentId = obj.agentId;
  if (obj.messageId) base.messageId = obj.messageId;
  if (obj.name) base.name = obj.name;
  if (obj.content) base.content = obj.content;
  if (obj.delta != null) {
    if (Array.isArray(obj.delta)) {
      base.delta = obj.delta;
    } else if (typeof obj.delta === 'object') {
      base.delta = Object.entries(obj.delta as Record<string, unknown>).map(([key, value]) => ({
        op: 'add', path: `/${key}`, value,
      }));
    } else if (typeof obj.delta === 'string') {
      base.delta = obj.delta;
    }
  }
  if (obj.snapshot) base.snapshot = obj.snapshot;
  if (obj.toolCallName || obj.toolName) base.toolName = obj.toolCallName || obj.toolName;
  if (obj.toolCallId) base.toolCallId = obj.toolCallId;
  if (obj.args && typeof obj.args === 'object') base.toolCallArgs = obj.args;
  if (obj.message || obj.error) base.error = obj.message || obj.error;

  if (base.type === 'TEXT_MESSAGE_CONTENT' && !base.content && obj.delta) {
    if (typeof obj.delta === 'string') base.content = obj.delta;
  }

  return base as unknown as AgUiEvent;
}

export interface DemoPlayer {
  eventSource: AgUiEventSource;
  start: () => void;
  isRunning: boolean;
  speed: number;
  setSpeed: (s: number) => void;
  paused: boolean;
  setPaused: (p: boolean) => void;
}

export function useDemoEventSource(initialSpeed = 1): DemoPlayer {
  const handlersRef = useRef(new Set<(event: AgUiEvent) => void>());
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(initialSpeed);
  const [paused, setPaused] = useState(false);

  const speedRef = useRef(speed);
  const pausedRef = useRef(paused);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  const fixtureRef = useRef<FixtureEntry[] | null>(null);
  const cursorRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);

  const eventSource = useMemo<AgUiEventSource>(() => ({
    subscribe: (handler) => {
      handlersRef.current.add(handler);
      return () => { handlersRef.current.delete(handler); };
    },
  }), []);

  const emit = useCallback((event: AgUiEvent) => {
    for (const handler of handlersRef.current) handler(event);
  }, []);

  const scheduleNext = useCallback(() => {
    if (cancelledRef.current) return;
    const fixture = fixtureRef.current;
    if (!fixture) return;

    const idx = cursorRef.current;
    if (idx >= fixture.length) {
      setIsRunning(false);
      return;
    }

    if (pausedRef.current) {
      timerRef.current = setTimeout(scheduleNext, 100);
      return;
    }

    const entry = fixture[idx];
    const prevDelay = idx > 0 ? fixture[idx - 1].delay_ms : 0;
    const gap = Math.max(0, (entry.delay_ms - prevDelay) / speedRef.current);

    timerRef.current = setTimeout(() => {
      if (cancelledRef.current) return;
      const parsed = parseEvent(entry.event);
      if (parsed) emit(parsed);
      cursorRef.current = idx + 1;
      scheduleNext();
    }, gap);
  }, [emit]);

  const start = useCallback(async () => {
    cancelledRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);

    if (!fixtureRef.current) {
      try {
        const resp = await fetch('/demo/boardroom.jsonl');
        const text = await resp.text();
        fixtureRef.current = text
          .split('\n')
          .filter(Boolean)
          .map((line) => JSON.parse(line) as FixtureEntry);
      } catch (err) {
        emit({ type: 'RUN_ERROR', error: (err as Error).message ?? 'Failed to load demo fixture' });
        return;
      }
    }

    cursorRef.current = 0;
    cancelledRef.current = false;
    setIsRunning(true);
    scheduleNext();
  }, [emit, scheduleNext]);

  // Resume scheduling when unpaused
  useEffect(() => {
    if (!paused && isRunning && fixtureRef.current && cursorRef.current < fixtureRef.current.length) {
      if (timerRef.current) clearTimeout(timerRef.current);
      scheduleNext();
    }
  }, [paused, isRunning, scheduleNext]);

  // Reschedule on speed change so the next gap uses the new speed
  useEffect(() => {
    if (isRunning && !pausedRef.current && fixtureRef.current) {
      if (timerRef.current) clearTimeout(timerRef.current);
      scheduleNext();
    }
  }, [speed, isRunning, scheduleNext]);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { eventSource, start, isRunning, speed, setSpeed, paused, setPaused };
}
