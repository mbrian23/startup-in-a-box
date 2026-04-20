/**
 * Zone coordinate constants for both screens.
 *
 * Keys are const-typed string literals matching the tool/action names
 * used by the orchestrator and factory agents. This is the single
 * source of truth for where workers walk on each tilemap.
 *
 * Tile pixel size is per-scene now (boardroom: 48, factory: 32) and
 * read from `WorldMap.tileDim` at the render layer. `TILE_SIZE` below
 * is retained only as a fallback for callers that don't have a map on
 * hand; nothing in the render path imports it any more.
 */

import {
  TOOL_GOOGLE_SEARCH,
  TOOL_WEB_SEARCH,
  TOOL_GENERATE_ARTIFACTS,
  TOOL_DELEGATE_TO_FACTORY,
} from '../data/tool-names';

/** Legacy default tile size (factory). Prefer `WorldMap.tileDim`. */
export const TILE_SIZE = 32;

export interface ZoneCoord {
  readonly x: number;
  readonly y: number;
}

/**
 * Boardroom screen zones — aligned to the retro-office background
 * (13×12 grid at 48px/tile).
 *
 *   google/web search     → Marcus's desk (front-left student desk)
 *   generate_artifacts    → front centre, in front of the CEO's desk
 *   delegate_to_factory   → south-east corridor toward the "factory"
 *                           exit (south wall)
 */
export const BOARDROOM_ZONES = {
  [TOOL_GOOGLE_SEARCH]: { x: 5, y: 7 },
  [TOOL_WEB_SEARCH]: { x: 5, y: 7 },
  [TOOL_GENERATE_ARTIFACTS]: { x: 6, y: 3 },
  [TOOL_DELEGATE_TO_FACTORY]: { x: 11, y: 9 },
} as const satisfies Record<string, ZoneCoord>;

/**
 * Work station zones — clear tiles adjacent to each character's desk.
 * The boardroom now uses `BOARDROOM_CHARACTERS.idlePosition` as the
 * primary home; these entries exist for back-compat with a handful
 * of legacy callers.
 */
export const BOARDROOM_WORK_STATIONS: Record<string, ZoneCoord> = {
  visionary: { x: 2, y: 6 },
  scout: { x: 6, y: 6 },
  blueprint: { x: 10, y: 6 },
};

/**
 * Fallback handoff meet point when a peer character can't be found.
 * With `HANDOFF_MAX_STEPS = 0` the real path rarely routes through
 * this point; it only comes into play if the peer lookup fails.
 */
export const BOARDROOM_MEET_POINT: ZoneCoord = { x: 6, y: 7 };
