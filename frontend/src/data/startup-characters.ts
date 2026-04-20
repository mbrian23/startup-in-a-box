/**
 * Character-role mapping for both screens.
 *
 * Each role maps to a sprite ID (f1-f8) from the existing characters table
 * and a default idle position on its respective tilemap.
 */

import type { ZoneCoord } from '../lib/zones';
import stationsJson from './boardroom-stations.json';

export type Orientation = 'up' | 'down' | 'left' | 'right';

export interface StartupCharacter {
  readonly id: string;
  readonly role: string;
  readonly sprite: string;
  readonly screen: 'boardroom' | 'factory';
  readonly idlePosition: ZoneCoord;
  /** Direction the character faces at idle (when not moving and not
   *  overridden by the debug tool). Only the boardroom stations supply
   *  one — factory characters fall back to the spatial bridge's
   *  "facing camera" default. */
  readonly defaultOrientation?: Orientation;
  /**
   * Default thought-bubble text shown the moment this character becomes the
   * active agent. Stays visible until the agent's structured output supplies
   * a real `thought_bubble` (or until the next handoff). Boardroom
   * specialists run as AgentTools that don't stream prose, so without this
   * the audience would just see a silent thinking cloud for most of their turn.
   */
  readonly thinkingSummary?: string;
  /** One-line persona blurb shown when the audience clicks the sprite. */
  readonly description?: string;
}

/**
 * Short persona blurbs — surfaced when the viewer taps a character sprite.
 * Kept in a side map so the main roster stays a clean table.
 */
const CHARACTER_DESCRIPTIONS: Record<string, string> = {
  ceo: 'Visionary CEO who rallies the crew and keeps everyone aimed at the mission.',
  visionary: 'Product strategist who sharpens raw ideas into a testable vision.',
  scout: 'Market researcher sniffing out competitors, trends, and hidden demand.',
  blueprint: 'Brand director shaping the voice, look, and feel customers remember.',
  'business-planner': 'Ops lead turning strategy into a concrete operating plan.',
  strategist: 'Lean-canvas strategist zeroing in on problem-solution fit fast.',
  cto: 'CTO translating the product vision into a buildable technical plan.',
  reviewer: 'Plan reviewer who stress-tests assumptions before execution starts.',
  'lead-dev': 'Lead architect designing the system and setting the coding direction.',
  explorer: 'Senior engineer who explores the codebase and ships the core build.',
  qa: 'Quality lead writing tests and guarding against silent regressions.',
  devops: 'DevOps engineer wiring the build, deploy, and infrastructure glue.',
  supervisor: 'Factory manager coordinating handoffs and keeping the build on track.',
};

interface StationJson {
  x: number;
  y: number;
  orientation?: Orientation;
}

const STATIONS = stationsJson.stations as Record<string, StationJson>;

function station(id: string): { idlePosition: ZoneCoord; defaultOrientation?: Orientation } {
  const s = STATIONS[id];
  if (!s) throw new Error(`boardroom-stations.json missing station for "${id}"`);
  return {
    idlePosition: { x: s.x, y: s.y },
    ...(s.orientation ? { defaultOrientation: s.orientation } : {}),
  };
}

/**
 * Boardroom characters — idle positions on the retro-office floor plan.
 *
 * The boardroom is a 13×12 grid (see `boardroom-collision.ts`). Theo
 * stands at the front by his desk and addresses the team; each
 * specialist stays at their own workstation and turns to face Theo
 * when called. Positions must:
 *
 *   1. Be walkable (i.e. not in `BOARDROOM_MAP.blockedTiles`).
 *   2. Have the tile directly SOUTH also walkable — characters are
 *      anchored center with a 32px sprite, so feet land in the row
 *      below the coord. If that row has furniture, the character
 *      appears to stand ON it.
 *
 * Symbols on the ASCII map in `boardroom-collision.ts` give a hint
 * for where each station is (`C` = Theo, `1`-`6` = specialists);
 * Aditi doesn't have an ASCII marker — she stands by the filing desk.
 *
 * Sprite reuse across screens is intentional — boardroom and factory
 * render in isolation, so f2/f4/f6/f7 can double up without visual clash.
 */
export const BOARDROOM_CHARACTERS: readonly StartupCharacter[] = [
  { id: 'ceo',              role: 'Theo · CEO',                sprite: 'f2', screen: 'boardroom', ...station('ceo') },
  { id: 'visionary',        role: 'Rin · Product Strategy',    sprite: 'f1', screen: 'boardroom', ...station('visionary') },
  { id: 'scout',            role: 'Marcus · Market Research',  sprite: 'f5', screen: 'boardroom', ...station('scout') },
  { id: 'blueprint',        role: 'Juno · Brand Director',     sprite: 'f3', screen: 'boardroom', ...station('blueprint') },
  { id: 'business-planner', role: 'Eloise · Operating Plan',   sprite: 'f4', screen: 'boardroom', ...station('business-planner') },
  { id: 'strategist',       role: 'Yara · Lean Canvas',        sprite: 'f8', screen: 'boardroom', ...station('strategist') },
  { id: 'cto',              role: 'Sam · Build Plan',          sprite: 'f7', screen: 'boardroom', ...station('cto') },
  { id: 'reviewer',         role: 'Aditi · Plan Reviewer',     sprite: 'f6', screen: 'boardroom', ...station('reviewer') },
];

/**
 * Factory characters — idle positions near their workstations.
 *
 * IDs match AGENT_REGISTRY.characterId for each Claude Agent SDK subagent:
 *   architect      → lead-dev
 *   implementer    → explorer
 *   tester         → qa
 *   devops         → devops
 *   build_reviewer → supervisor (also used by the main `factory` agent)
 */
export const FACTORY_CHARACTERS: readonly StartupCharacter[] = [
  { id: 'lead-dev',   role: 'Kai · Lead Architect',   sprite: 'f2', screen: 'factory', idlePosition: { x: 3,  y: 6 } },
  { id: 'explorer',   role: 'Lina · Senior Engineer', sprite: 'f4', screen: 'factory', idlePosition: { x: 10, y: 6 } },
  { id: 'qa',         role: 'Priya · Quality Lead',   sprite: 'f6', screen: 'factory', idlePosition: { x: 4,  y: 9 } },
  { id: 'devops',     role: 'Rafi · DevOps',          sprite: 'f7', screen: 'factory', idlePosition: { x: 25, y: 4 } },
  { id: 'supervisor', role: 'Max · Factory Mgr',      sprite: 'f8', screen: 'factory', idlePosition: { x: 17, y: 8 } },
] as const;

/** Lookup by character ID across both rosters. */
export const ALL_CHARACTERS = new Map<string, StartupCharacter>(
  [...BOARDROOM_CHARACTERS, ...FACTORY_CHARACTERS].map((c) => [
    c.id,
    { ...c, description: CHARACTER_DESCRIPTIONS[c.id] },
  ]),
);
