/**
 * Event-driven tutorial tooltips with prev/next navigation.
 *
 * Subscribes to any AgUiEventSource and fires contextual tooltips
 * based on trigger rules loaded from /demo/tooltips.json. Supports
 * both auto-advance (on timer) and manual prev/next browsing.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AgUiEvent, AgUiEventSource } from './ag-ui/types';

export interface TooltipDef {
  id: string;
  title: string;
  body: string;
  detail?: string;
  badge: string;
  badgeColor: string;
  trigger: {
    event: string;
    path?: string;
    matchValue?: unknown;
    excludeValues?: string[];
    firstOnly?: boolean;
  };
  position: string;
  durationMs: number;
}

export interface ActiveTooltip {
  def: TooltipDef;
  index: number;
  total: number;
}

export interface TutorialControls {
  active: ActiveTooltip | null;
  dismiss: () => void;
  prev: () => void;
  next: () => void;
  goTo: (index: number) => void;
  hasPrev: boolean;
  hasNext: boolean;
}

export function useTutorialTooltips(
  eventSource: AgUiEventSource | null,
  enabled = true,
): TutorialControls {
  const [allDefs, setAllDefs] = useState<TooltipDef[]>([]);
  const [active, setActive] = useState<ActiveTooltip | null>(null);
  // Ordered list of tooltip IDs that have been triggered (for prev/next)
  const historyRef = useRef<string[]>([]);
  const cursorRef = useRef(-1);
  const firedRef = useRef(new Set<string>());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueRef = useRef<TooltipDef[]>([]);

  useEffect(() => {
    if (!enabled) return;
    void fetch('/demo/tooltips.json')
      .then((r) => r.json())
      .then((data: TooltipDef[]) => setAllDefs(data))
      .catch(() => {});
  }, [enabled]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const show = useCallback((def: TooltipDef, addToHistory: boolean) => {
    clearTimer();
    if (addToHistory && !historyRef.current.includes(def.id)) {
      historyRef.current.push(def.id);
    }
    const idx = historyRef.current.indexOf(def.id);
    cursorRef.current = idx;
    setActive({ def, index: idx, total: historyRef.current.length });

    timerRef.current = setTimeout(() => {
      // Auto-advance: try the queue, otherwise hide
      if (queueRef.current.length > 0) {
        const next = queueRef.current.shift()!;
        show(next, true);
      } else {
        setActive(null);
      }
    }, def.durationMs);
  }, [clearTimer]);

  const enqueue = useCallback(
    (def: TooltipDef) => {
      if (firedRef.current.has(def.id)) return;
      firedRef.current.add(def.id);

      if (active === null && queueRef.current.length === 0) {
        show(def, true);
      } else {
        queueRef.current.push(def);
      }
    },
    [active, show],
  );

  const dismiss = useCallback(() => {
    clearTimer();
    if (queueRef.current.length > 0) {
      const next = queueRef.current.shift()!;
      show(next, true);
    } else {
      setActive(null);
    }
  }, [clearTimer, show]);

  const findDef = useCallback(
    (id: string) => allDefs.find((d) => d.id === id),
    [allDefs],
  );

  const prev = useCallback(() => {
    const idx = cursorRef.current - 1;
    if (idx < 0 || idx >= historyRef.current.length) return;
    const def = findDef(historyRef.current[idx]);
    if (def) show(def, false);
  }, [findDef, show]);

  const next = useCallback(() => {
    const idx = cursorRef.current + 1;
    if (idx < historyRef.current.length) {
      const def = findDef(historyRef.current[idx]);
      if (def) show(def, false);
    } else if (queueRef.current.length > 0) {
      const def = queueRef.current.shift()!;
      show(def, true);
    }
  }, [findDef, show]);

  const goTo = useCallback(
    (index: number) => {
      if (index < 0 || index >= historyRef.current.length) return;
      const def = findDef(historyRef.current[index]);
      if (def) show(def, false);
    },
    [findDef, show],
  );

  useEffect(() => {
    if (!eventSource || !enabled || allDefs.length === 0) return;

    const handler = (event: AgUiEvent) => {
      for (const def of allDefs) {
        if (firedRef.current.has(def.id)) continue;

        const t = def.trigger;
        if (t.event !== event.type) continue;

        if (t.path && event.type === 'STATE_DELTA' && event.delta) {
          let matched = false;
          for (const op of event.delta) {
            if (op.path !== t.path) continue;
            if (t.excludeValues && t.excludeValues.includes(String(op.value))) continue;
            if (t.matchValue !== undefined) {
              if (t.matchValue === 'awaiting' && typeof op.value === 'object' && op.value !== null) {
                if ((op.value as Record<string, unknown>).status === 'awaiting') {
                  matched = true;
                  break;
                }
              } else if (op.value === t.matchValue) {
                matched = true;
                break;
              }
            } else {
              matched = true;
              break;
            }
          }
          if (!matched) continue;
        }

        enqueue(def);
      }
    };

    const unsub = eventSource.subscribe(handler);
    return () => { unsub?.(); };
  }, [eventSource, enabled, allDefs, enqueue]);

  useEffect(() => {
    return () => { clearTimer(); };
  }, [clearTimer]);

  const hasPrev = cursorRef.current > 0;
  const hasNext = cursorRef.current < historyRef.current.length - 1 || queueRef.current.length > 0;

  return { active, dismiss, prev, next, goTo, hasPrev, hasNext };
}
