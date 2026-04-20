import { describe, it, expect } from 'vitest';
import { BOARDROOM_ZONES } from '../../src/lib/zones';
import { BOARDROOM_MAP } from '../../src/data/boardroom-layout';
import { BOARDROOM_ASCII, BOARDROOM_COLS } from '../../src/data/boardroom-collision';
import { BOARDROOM_CHARACTERS } from '../../src/data/startup-characters';
import type { WorldMap } from '../../src/lib/worldMap';

// Map of ASCII chars per tile so tests can distinguish walls (#) from
// furniture (D/S/T/F) when judging the "feet rule" (characters can
// lean on walls but not stand on desks).
const ASCII_CHARS: string[][] = (() => {
  const rows = BOARDROOM_ASCII.split('\n')
    .map((line) => line.replace(/\s+/g, ''))
    .filter((line) => line.length === BOARDROOM_COLS);
  const grid: string[][] = [];
  for (let y = 0; y < rows.length; y++) {
    grid[y] = [];
    for (let x = 0; x < BOARDROOM_COLS; x++) grid[y][x] = rows[y][x];
  }
  return grid;
})();

function isWalkable(map: WorldMap, x: number, y: number): boolean {
  if (map.blockedTiles) return !map.blockedTiles.has(`${x},${y}`);
  if (map.objectTiles) {
    for (const layer of map.objectTiles) {
      if (layer[x][y] !== -1) return false;
    }
  }
  return true;
}

function isWithinBounds(map: WorldMap, x: number, y: number): boolean {
  return x >= 0 && x < map.width && y >= 0 && y < map.height;
}

describe('Boardroom zones', () => {
  it.each(Object.entries(BOARDROOM_ZONES))(
    '%s at (%o) is within map bounds',
    (_name: string, zone: { x: number; y: number }) => {
      expect(isWithinBounds(BOARDROOM_MAP, zone.x, zone.y)).toBe(true);
    },
  );

  it.each(Object.entries(BOARDROOM_ZONES))(
    '%s at (%o) lands on a walkable tile',
    (_name: string, zone: { x: number; y: number }) => {
      expect(isWalkable(BOARDROOM_MAP, zone.x, zone.y)).toBe(true);
    },
  );
});

describe('Boardroom character stations', () => {
  it.each(BOARDROOM_CHARACTERS.map((c) => [c.id, c.idlePosition] as const))(
    '%s idle (%o) is walkable',
    (_id: string, pos: { x: number; y: number }) => {
      expect(isWalkable(BOARDROOM_MAP, pos.x, pos.y)).toBe(true);
    },
  );

  // Sprite anchor + 32px tall sprite means feet visually land in the
  // row below the idle tile. If that row has furniture the character
  // appears to stand on it (e.g. "Theo on the round table"). The outer
  // border rows/columns are walls — walls are the edge of the room,
  // not furniture with a raised visual top, so feet landing on them
  // is acceptable.
  it.each(BOARDROOM_CHARACTERS.map((c) => [c.id, c.idlePosition] as const))(
    '%s idle (%o) has a walkable tile directly south (feet rule)',
    (_id: string, pos: { x: number; y: number }) => {
      const south = { x: pos.x, y: pos.y + 1 };
      // A character's feet extend into the tile south of them. That
      // tile must be walkable OR a wall (`#` in the ASCII, including
      // the outer border) — walls are vertical surfaces, so leaning
      // feet look right. Furniture (D/S/T/F) would visually place
      // the character standing ON the desk, which is what we must
      // avoid.
      const isWall =
        south.y < 0 ||
        south.y >= BOARDROOM_MAP.height ||
        south.x < 0 ||
        south.x >= BOARDROOM_MAP.width ||
        ASCII_CHARS[south.y]?.[south.x] === '#';
      expect(isWalkable(BOARDROOM_MAP, south.x, south.y) || isWall).toBe(true);
    },
  );
});

describe('Zone key completeness', () => {
  it('boardroom has all required zone keys', () => {
    const requiredKeys = ['GoogleSearch', 'generate_artifacts', 'start_factory'] as const;
    for (const key of requiredKeys) {
      expect(BOARDROOM_ZONES).toHaveProperty(key);
    }
  });
});
