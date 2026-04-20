/**
 * Plain TypeScript interface for a WorldMap.
 *
 * A WorldMap describes the background and collision data for one
 * scene. Two rendering modes are supported:
 *
 *   1. **Tile-sliced tilemap.** Set `tileSetUrl`, `tileSetDimX/Y`,
 *      `bgTiles`, `objectTiles`. The renderer slices the tileset image
 *      and lays tiles out on the grid. Used by the factory and the
 *      old stamp-composed scenes.
 *
 *   2. **Static background image.** Set `backgroundImage` and
 *      `blockedTiles`. The renderer draws the PNG as a single sprite;
 *      pathfinding reads the hand-authored blocked set directly.
 *      Used by the retro-office boardroom.
 *
 * Only `width`, `height`, `tileDim`, and `animatedSprites` are required.
 * Everything else is optional so both modes can share the same type.
 */

/** `layer[x][y]` is the tileIndex, or -1 if empty. */
export type TileLayer = number[][];

export interface AnimatedSprite {
  x: number;
  y: number;
  w: number;
  h: number;
  layer: number;
  sheet: string;
  animation: string;
}

export interface WorldMap {
  /** Grid width in tiles. */
  width: number;
  /** Grid height in tiles. */
  height: number;
  /** Tile size in pixels (square). Per-scene: 32 for the factory,
   *  48 for the retro-office boardroom. */
  tileDim: number;

  /** Mode 2: Static background image. The PNG is drawn as a single
   *  sprite at (0, 0) sized to `width × height` pixels. Pathfinding
   *  consults `blockedTiles` instead of `objectTiles`. */
  backgroundImage?: { url: string; width: number; height: number };
  /** Mode 2: Set of blocked tile coords as `"x,y"` strings. When
   *  present, `buildWalkableGrid` uses this INSTEAD of the hardcoded
   *  wall border + objectTiles check — the ASCII map owns the full
   *  walkable/blocked specification. */
  blockedTiles?: ReadonlySet<string>;

  /** Mode 1: tileset atlas URL. */
  tileSetUrl?: string;
  /** Mode 1: tileset image width in pixels. */
  tileSetDimX?: number;
  /** Mode 1: tileset image height in pixels. */
  tileSetDimY?: number;
  /** Mode 1: background tile layers `[layer][x][y]`. */
  bgTiles?: number[][][];
  /** Mode 1: object / collision tile layers. */
  objectTiles?: TileLayer[];

  animatedSprites: AnimatedSprite[];
}
