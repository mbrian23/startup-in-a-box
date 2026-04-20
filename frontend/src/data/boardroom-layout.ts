/**
 * Boardroom layout — retro-office scene backed by a static PNG.
 *
 * Collision data lives in `boardroom-collision.ts` as an ASCII floor
 * plan that lines up with the image.
 *
 * Grid: 13 cols × 12 rows at 48 px/tile (624×576 — matches the PNG).
 */

import type { WorldMap } from '../lib/worldMap';
import {
  BOARDROOM_ASCII,
  BOARDROOM_COLS,
  BOARDROOM_ROWS,
  parseBoardroomAscii,
} from './boardroom-collision';
import stationsJson from './boardroom-stations.json';

const TILE_DIM = 48;
const IMAGE_URL = '/assets/retro-office.png';
const IMAGE_W = BOARDROOM_COLS * TILE_DIM;
const IMAGE_H = BOARDROOM_ROWS * TILE_DIM;

const collision = parseBoardroomAscii(BOARDROOM_ASCII);

// Persisted walkability edits (committed via the debug overlay) are
// stored as a symmetric-difference set against the ASCII source: each
// entry flips the tile's walkable state.
const overrideList: string[] = Array.isArray(
  (stationsJson as { blockedOverrides?: unknown }).blockedOverrides,
)
  ? ((stationsJson as { blockedOverrides: string[] }).blockedOverrides)
  : [];

const effectiveBlocked = new Set<string>(collision.blocked);
for (const key of overrideList) {
  if (effectiveBlocked.has(key)) effectiveBlocked.delete(key);
  else effectiveBlocked.add(key);
}

/** Build a boardroom map with a custom background image URL.
 *
 * All themes share the same collision grid (624×576, 13×12 @ 48px)
 * because every themed boardroom PNG is composed around the same 3×2
 * desk grid the agents sit at. Only the background image changes.
 */
export function buildBoardroomMap(imageUrl: string): WorldMap {
  return {
    width: BOARDROOM_COLS,
    height: BOARDROOM_ROWS,
    tileDim: TILE_DIM,
    backgroundImage: { url: imageUrl, width: IMAGE_W, height: IMAGE_H },
    blockedTiles: effectiveBlocked,
    animatedSprites: [],
  };
}

export const BOARDROOM_MAP: WorldMap = buildBoardroomMap(IMAGE_URL);

/** Exported so debug tooling and tests can inspect the raw markers
 *  (e.g. the `C` / `1`-`6` station hints from the ASCII map). */
export const BOARDROOM_MARKERS = collision.markers;
