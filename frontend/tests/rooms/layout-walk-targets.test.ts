/**
 * Regression guard: every walk-target cell referenced by character
 * spawns or zone coordinates MUST be walkable. If a future edit to the
 * boardroom ASCII map or the zone table causes a collision, this test
 * fails in CI before a character ends up embedded in furniture.
 */
import { describe, expect, it } from 'vitest';
import { BOARDROOM_MAP } from '../../src/data/boardroom-layout';
import { BOARDROOM_ZONES } from '../../src/lib/zones';
import { BOARDROOM_CHARACTERS } from '../../src/data/startup-characters';
import type { WorldMap } from '../../src/lib/worldMap';

function isWalkable(map: WorldMap, x: number, y: number): boolean {
  if (map.blockedTiles) return !map.blockedTiles.has(`${x},${y}`);
  if (map.objectTiles) {
    for (const layer of map.objectTiles) {
      if (layer[x][y] !== -1) return false;
    }
  }
  return true;
}

describe('Boardroom walk-target cells are walkable', () => {
  const walkTargets: Array<readonly [string, number, number]> = [
    ...BOARDROOM_CHARACTERS.map(
      (c) => [c.id, c.idlePosition.x, c.idlePosition.y] as const,
    ),
    ...Object.entries(BOARDROOM_ZONES).map(
      ([name, z]) => [name, z.x, z.y] as const,
    ),
  ];

  it.each(walkTargets)('%s (%i, %i) is walkable', (_label: string, x: number, y: number) => {
    expect(isWalkable(BOARDROOM_MAP, x, y)).toBe(true);
  });
});
