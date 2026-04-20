/**
 * Runtime override store for the boardroom debug overlay.
 *
 * Three flavours of override live here, all populated by the
 * click-to-move UX in `TileDebugOverlay`:
 *
 *   1. **positions** — `characterId → {x,y}`. Where a character stands.
 *   2. **rotations** — `characterId → orientation`. Which way they face.
 *   3. **blockedToggle** — set of `"x,y"` tile keys whose walkability
 *      is *flipped* from the ASCII source (a walkable tile becomes
 *      blocked, a blocked tile becomes walkable).
 *
 * Consumers:
 *   - `WorkerRenderer` — reads position + rotation, forces the
 *     character to spawn/face there.
 *   - `buildWalkableGrid` — reads `effectiveBlocked(map)` so pathfinding
 *     respects the toggled tiles.
 *   - `OverridesPanel` — renders everything as a TS-ready snippet.
 *
 * Production cost: zero. Nothing writes to the store unless the debug
 * overlay is active.
 */

import { useSyncExternalStore } from 'react';

export type Orientation = 'up' | 'down' | 'left' | 'right';

const positions = new Map<string, { x: number; y: number }>();
const rotations = new Map<string, Orientation>();
const blockedToggle = new Set<string>();
const listeners = new Set<() => void>();
let version = 0;

export type PaintMode = 'off' | 'toggle' | 'block' | 'free';
let paintMode: PaintMode = 'off';

export function getPaintMode(): PaintMode {
  return paintMode;
}

export function setPaintMode(m: PaintMode): void {
  if (paintMode === m) return;
  paintMode = m;
  notify();
}

/** Force-set a tile's effective state. source-aware: only toggles when needed. */
export function setTileBlocked(
  key: string,
  target: boolean,
  source: ReadonlySet<string> | undefined,
): void {
  const sourceHas = source?.has(key) ?? false;
  const currentlyBlocked = sourceHas !== blockedToggle.has(key);
  if (currentlyBlocked === target) return;
  if (blockedToggle.has(key)) blockedToggle.delete(key);
  else blockedToggle.add(key);
  notify();
}

function notify(): void {
  version++;
  for (const l of listeners) l();
}

// ── Position ─────────────────────────────────────────────────────────
export function setOverride(id: string, pos: { x: number; y: number }): void {
  const prev = positions.get(id);
  if (prev && prev.x === pos.x && prev.y === pos.y) return;
  positions.set(id, { x: pos.x, y: pos.y });
  notify();
}

export function getOverride(id: string): { x: number; y: number } | null {
  const v = positions.get(id);
  return v ? { x: v.x, y: v.y } : null;
}

// ── Rotation ─────────────────────────────────────────────────────────
export function setRotationOverride(id: string, dir: Orientation): void {
  if (rotations.get(id) === dir) return;
  rotations.set(id, dir);
  notify();
}

export function getRotationOverride(id: string): Orientation | null {
  return rotations.get(id) ?? null;
}

// ── Blocked-tile toggle ──────────────────────────────────────────────
export function toggleBlockedTile(key: string): void {
  if (blockedToggle.has(key)) blockedToggle.delete(key);
  else blockedToggle.add(key);
  notify();
}

/** Effective blocked-tiles set = source ⊕ toggle (per-tile XOR). */
export function effectiveBlocked(
  source: ReadonlySet<string> | undefined,
): ReadonlySet<string> {
  if (!source && blockedToggle.size === 0) return EMPTY_SET;
  if (blockedToggle.size === 0) return source ?? EMPTY_SET;
  const out = new Set<string>(source ?? []);
  for (const key of blockedToggle) {
    if (out.has(key)) out.delete(key);
    else out.add(key);
  }
  return out;
}

const EMPTY_SET: ReadonlySet<string> = new Set();

// ── Bulk reset ───────────────────────────────────────────────────────
export function clearAllOverrides(): void {
  if (positions.size === 0 && rotations.size === 0 && blockedToggle.size === 0) return;
  positions.clear();
  rotations.clear();
  blockedToggle.clear();
  notify();
}

// ── Snapshots for rendering ──────────────────────────────────────────
export function snapshotOverrides(): {
  positions: ReadonlyMap<string, { x: number; y: number }>;
  rotations: ReadonlyMap<string, Orientation>;
  blockedToggle: ReadonlySet<string>;
} {
  return {
    positions: new Map(positions),
    rotations: new Map(rotations),
    blockedToggle: new Set(blockedToggle),
  };
}

// ── Subscription ─────────────────────────────────────────────────────
export function useOverridesVersion(): number {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
      };
    },
    () => version,
    () => version,
  );
}
