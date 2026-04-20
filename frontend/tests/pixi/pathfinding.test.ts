/**
 * Pathfinding tests — BFS on a synthetic WorldMap.
 *
 * Builds minimal tilemaps just large enough to exercise borders, object
 * obstacles, blocked-tile overlays, and unreachable goals.
 */

import { describe, it, expect } from 'vitest';
import type { WorldMap } from '../../src/lib/worldMap';
import { buildWalkableGrid, findPath, type Tile } from '../../src/pixi/lib/pathfinding';

function makeMap(w: number, h: number, obstacles: Tile[] = []): WorldMap {
  const bg: number[][] = Array.from({ length: w }, () =>
    new Array(h).fill(0),
  );
  const obj: number[][] = Array.from({ length: w }, () =>
    new Array(h).fill(-1),
  );
  for (const { x, y } of obstacles) obj[x][y] = 99;
  return {
    width: w,
    height: h,
    tileSetUrl: '',
    tileSetDimX: 0,
    tileSetDimY: 0,
    tileDim: 32,
    bgTiles: [bg],
    objectTiles: [obj],
    animatedSprites: [],
  };
}

describe('buildWalkableGrid', () => {
  it('marks default wall borders (top=2, right=1, bottom=2, left=1) as blocked', () => {
    const grid = buildWalkableGrid(makeMap(10, 10));
    expect(grid[0][5]).toBe(false); // left border
    expect(grid[9][5]).toBe(false); // right border
    expect(grid[5][0]).toBe(false); // top border row 0
    expect(grid[5][1]).toBe(false); // top border row 1
    expect(grid[5][8]).toBe(false); // bottom border row 8
    expect(grid[5][9]).toBe(false); // bottom border row 9
    expect(grid[5][5]).toBe(true); // interior tile
  });

  it('marks tiles with object-layer content as blocked', () => {
    const grid = buildWalkableGrid(makeMap(10, 10, [{ x: 5, y: 5 }]));
    expect(grid[5][5]).toBe(false);
    expect(grid[4][5]).toBe(true);
  });

  it('honors the extra-blocked overlay', () => {
    const grid = buildWalkableGrid(makeMap(10, 10), [{ x: 3, y: 3 }]);
    expect(grid[3][3]).toBe(false);
  });
});

describe('findPath', () => {
  it('returns [] when start equals goal', () => {
    const grid = buildWalkableGrid(makeMap(10, 10));
    expect(findPath(grid, { x: 4, y: 4 }, { x: 4, y: 4 })).toEqual([]);
  });

  it('routes around an obstacle', () => {
    // Wall of obstacles at column 5, rows 2..7 — must detour.
    const obstacles: Tile[] = [];
    for (let y = 2; y <= 7; y++) obstacles.push({ x: 5, y });
    const grid = buildWalkableGrid(makeMap(12, 10, obstacles));
    const path = findPath(grid, { x: 3, y: 5 }, { x: 7, y: 5 });
    // Path must not cross (5, 2..7).
    for (const step of path) {
      expect(obstacles).not.toContainEqual(step);
    }
    // Last waypoint is the goal.
    expect(path.at(-1)).toEqual({ x: 7, y: 5 });
  });

  it('re-targets to nearest walkable when goal itself is blocked', () => {
    const grid = buildWalkableGrid(makeMap(10, 10, [{ x: 5, y: 5 }]));
    const path = findPath(grid, { x: 3, y: 5 }, { x: 5, y: 5 });
    // Final step is a walkable neighbor of the original blocked goal.
    const last = path.at(-1)!;
    expect(grid[last.x][last.y]).toBe(true);
    expect(Math.abs(last.x - 5) + Math.abs(last.y - 5)).toBeLessThanOrEqual(1);
  });

  it('produces adjacent waypoints only (4-way steps)', () => {
    const grid = buildWalkableGrid(makeMap(12, 10));
    const path = findPath(grid, { x: 2, y: 5 }, { x: 9, y: 5 });
    let prev = { x: 2, y: 5 };
    for (const step of path) {
      const d = Math.abs(step.x - prev.x) + Math.abs(step.y - prev.y);
      expect(d).toBe(1);
      prev = step;
    }
  });
});
