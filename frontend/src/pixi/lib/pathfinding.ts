/**
 * 4-way BFS pathfinding on a WorldMap tilemap.
 *
 * A tile is walkable when it's inside the interior wall border and its
 * object-layer slot is empty (`-1`). Callers can pass additional blocked
 * tiles (e.g. other characters' idle positions) so paths route around
 * occupied seats. The BFS is run on demand when a character's target tile
 * changes, not per frame, so the 30×16 grid is trivial to search.
 */

import type { WorldMap } from '../../lib/worldMap';
import { effectiveBlocked } from '../debug/position-overrides';

export interface Tile {
  readonly x: number;
  readonly y: number;
}

// Matches RoomBuilder's DEFAULT_WALL_THICKNESS ([top, right, bottom, left]).
// Only applied when the map doesn't supply its own `blockedTiles` set —
// image-backed maps (the retro-office boardroom) author walls explicitly
// in their ASCII floor plan and don't want an implicit 2/1/2/1 border.
const WALL_TOP = 2;
const WALL_RIGHT = 1;
const WALL_BOTTOM = 2;
const WALL_LEFT = 1;

export function buildWalkableGrid(
  map: WorldMap,
  blocked: Iterable<Tile> = [],
): boolean[][] {
  const { width: w, height: h } = map;
  const grid: boolean[][] = Array.from({ length: w }, () => new Array(h).fill(false));

  if (map.blockedTiles) {
    // Mode 2: authored blocked set (possibly tweaked by the debug
    // overlay's per-tile toggle) owns the whole walkability spec.
    // Walls and furniture are both encoded in the ASCII floor plan, so
    // we don't apply a hardcoded border here.
    const bt = effectiveBlocked(map.blockedTiles);
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        grid[x][y] = !bt.has(`${x},${y}`);
      }
    }
  } else {
    // Mode 1: tile-based walls + object layer.
    const objects = map.objectTiles?.[0];
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        const isBorder =
          x < WALL_LEFT || x >= w - WALL_RIGHT || y < WALL_TOP || y >= h - WALL_BOTTOM;
        const hasObject = objects?.[x]?.[y] !== undefined && objects[x][y] !== -1;
        grid[x][y] = !isBorder && !hasObject;
      }
    }
  }

  for (const { x, y } of blocked) {
    if (x >= 0 && x < w && y >= 0 && y < h) grid[x][y] = false;
  }

  return grid;
}

function inBounds(grid: boolean[][], x: number, y: number): boolean {
  return x >= 0 && x < grid.length && y >= 0 && y < grid[0].length;
}

function nearestWalkable(grid: boolean[][], goal: Tile): Tile | null {
  // Iterate by Manhattan distance so cardinal neighbors win over diagonals —
  // a diagonal neighbor would trap the 4-way pathfinder one tile short.
  const maxDist = grid.length + grid[0].length;
  for (let d = 1; d <= maxDist; d++) {
    for (let dx = -d; dx <= d; dx++) {
      const dy = d - Math.abs(dx);
      for (const sy of dy === 0 ? [0] : [-dy, dy]) {
        const x = goal.x + dx;
        const y = goal.y + sy;
        if (inBounds(grid, x, y) && grid[x][y]) return { x, y };
      }
    }
  }
  return null;
}

const NEIGHBORS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/**
 * Return the sequence of tiles from `start` (exclusive) to `goal` (inclusive).
 * If the goal is blocked, route to the nearest walkable tile instead. If the
 * start tile itself is blocked (character spawned on furniture, or another
 * character's tile is blocking the path), we allow stepping off it before
 * enforcing walkability.
 */
export function findPath(grid: boolean[][], start: Tile, goal: Tile): Tile[] {
  if (start.x === goal.x && start.y === goal.y) return [];

  let effectiveGoal = goal;
  if (!inBounds(grid, goal.x, goal.y) || !grid[goal.x][goal.y]) {
    effectiveGoal = nearestWalkable(grid, goal) ?? goal;
  }

  const startKey = `${start.x},${start.y}`;
  const goalKey = `${effectiveGoal.x},${effectiveGoal.y}`;
  if (startKey === goalKey) return [];

  const parent = new Map<string, string>();
  const visited = new Set<string>([startKey]);
  const queue: Tile[] = [start];

  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const [dx, dy] of NEIGHBORS) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (!inBounds(grid, nx, ny)) continue;
      const nk = `${nx},${ny}`;
      if (visited.has(nk)) continue;
      const isGoal = nx === effectiveGoal.x && ny === effectiveGoal.y;
      if (!grid[nx][ny] && !isGoal) continue;
      visited.add(nk);
      parent.set(nk, `${cur.x},${cur.y}`);
      if (isGoal) return reconstruct(parent, startKey, nk);
      queue.push({ x: nx, y: ny });
    }
  }

  // No reachable path — return a single-step target so the worker still moves
  // toward the goal rather than locking in place.
  return [effectiveGoal];
}

function reconstruct(
  parent: Map<string, string>,
  startKey: string,
  endKey: string,
): Tile[] {
  const path: Tile[] = [];
  let k = endKey;
  while (k !== startKey) {
    const [x, y] = k.split(',').map(Number);
    path.push({ x, y });
    const p = parent.get(k);
    if (!p) break;
    k = p;
  }
  return path.reverse();
}
