/**
 * Boardroom collision map — hand-authored ASCII floor plan.
 *
 * The retro-office background is rendered from a single PNG
 * (`/assets/retro-office.png`). Pathfinding needs to know which tiles
 * are walkable vs. blocked; instead of listing {x,y} pairs we draw the
 * whole room as ASCII art that lines up visually with the image.
 *
 * ## Grid
 *
 * 13 columns × 12 rows, one character per tile. Whitespace between
 * characters is ignored by the parser — it's only there so the source
 * reads as a grid. Each logical row MUST contain exactly 13 non-space
 * characters.
 *
 * ## Legend
 *
 *   #  wall / border            (blocked)
 *   S  shelf / bookcase         (blocked)
 *   T  teacher's desk / monitor (blocked)
 *   D  student desk             (blocked)
 *   F  filing desk              (blocked)
 *   .  floor                    (walkable)
 *   C  CEO standing spot        (walkable — marker for Theo)
 *   A  Aditi (plan reviewer)    (walkable — marker)
 *   1-6 specialist spots        (walkable — markers for the team)
 *
 * ## Human-review workflow
 *
 * 1. Open this file. Read the map top-down, left-to-right.
 * 2. Each letter or `#` blocks the corresponding tile in the image.
 * 3. Tweak a character, save, hit Fast Refresh.
 * 4. In the running app, click the **Debug** button in HudShell to see
 *    red-tinted blocked tiles overlaid on the retro office. The
 *    overlay also draws a yellow dot on every character home — use it
 *    to confirm each character stands on a walkable tile whose south
 *    neighbour is also walkable (the "feet don't land on furniture"
 *    rule).
 */

/* eslint-disable no-irregular-whitespace */
export const BOARDROOM_ASCII = `
# # # # # # # # # # # # #
# S S # # T T T # # S S #
# S S # # T T T # # S S #
# F # . . . C . . . # # #
# . . . . . . . . . . . #
# . . D D . D D . D D . #
# . 1 . . . 2 . . . 3 . #
# # . # # . # # . # # . #
# # . . . . . . . . . . #
# # 4 . . . 5 . . . 6 . #
# # # # # # # # # # # # #
# # # # # # # # # # # # #
`;
/* eslint-enable no-irregular-whitespace */

/** Width of the grid in tiles. */
export const BOARDROOM_COLS = 13;
/** Height of the grid in tiles. */
export const BOARDROOM_ROWS = 12;

/** Characters that are walkable. Everything else is blocked. */
const WALKABLE: ReadonlySet<string> = new Set(['.', 'C', 'A', '1', '2', '3', '4', '5', '6', '7']);

export interface ParsedCollision {
  /** Set of "x,y" keys for every blocked tile. */
  readonly blocked: ReadonlySet<string>;
  /** Marker tiles by symbol (e.g. 'C' → {x, y}). Useful for sanity-
   *  checking that character idle positions in startup-characters.ts
   *  match the map authors' intent. */
  readonly markers: ReadonlyMap<string, { x: number; y: number }>;
}

/** Parse BOARDROOM_ASCII into a blocked set + marker positions. */
export function parseBoardroomAscii(ascii: string = BOARDROOM_ASCII): ParsedCollision {
  const blocked = new Set<string>();
  const markers = new Map<string, { x: number; y: number }>();

  const rows = ascii
    .split('\n')
    .map((line) => line.replace(/\s+/g, ''))
    .filter((line) => line.length > 0);

  if (rows.length !== BOARDROOM_ROWS) {
    throw new Error(
      `boardroom-collision: expected ${BOARDROOM_ROWS} rows, got ${rows.length}`,
    );
  }

  for (let y = 0; y < rows.length; y++) {
    const row = rows[y];
    if (row.length !== BOARDROOM_COLS) {
      throw new Error(
        `boardroom-collision: row ${y} has ${row.length} cells, expected ${BOARDROOM_COLS}`,
      );
    }
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (!WALKABLE.has(ch)) {
        blocked.add(`${x},${y}`);
      }
      if (ch !== '.' && ch !== '#' && !markers.has(ch)) {
        // Record the FIRST occurrence of each marker symbol. Walkable
        // markers (C, 1-7) double as sanity-check anchors; furniture
        // markers (S/T/D/F) are included so tooling can find the
        // top-left corner of each piece if needed.
        markers.set(ch, { x, y });
      }
    }
  }

  return { blocked, markers };
}
