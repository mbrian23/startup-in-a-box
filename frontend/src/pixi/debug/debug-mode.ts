/**
 * Global debug-mode toggle. Press `G` to flip it on/off; consumers
 * (TileDebugOverlay, OverridesPanel, anything else that wants to be
 * dev-only) subscribe with `useDebugMode()`.
 *
 * Central so the Pixi overlay and the HTML panel show and hide in
 * lockstep — nothing worse than a ghost panel floating when the grid
 * overlay has been toggled off.
 */

import { useEffect, useSyncExternalStore } from 'react';

let enabled = false;
const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

export function setDebugMode(next: boolean): void {
  if (enabled === next) return;
  enabled = next;
  notify();
}

export function toggleDebugMode(): void {
  enabled = !enabled;
  notify();
}

export function isDebugMode(): boolean {
  return enabled;
}

/** React hook. Returns current debug flag; re-renders on change. */
export function useDebugMode(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
      };
    },
    () => enabled,
    () => false,
  );
}

/** Installs a single window-level `G` keydown listener. Intended to be
 *  called once from a top-level mount; safe to call repeatedly but
 *  each caller must invoke the returned dispose. */
export function useDebugHotkey(): void {
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== 'g' && ev.key !== 'G') return;
      const target = ev.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      toggleDebugMode();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
