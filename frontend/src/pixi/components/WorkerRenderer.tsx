'use client';

/**
 * WorkerRenderer — owns spatial resolution + animation for one character.
 *
 * Receives semantic AgentState + zone config, resolves to spatial WorkerState
 * internally using its own position refs, then renders visuals. Movement uses
 * BFS pathfinding on the tilemap's object layer so characters route around
 * furniture and settled peers instead of walking straight through them.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { useTick } from '@pixi/react';
import type * as PIXI from 'pixi.js';
import type { AgentState } from '../../hooks/ag-ui/types';
import type { ZoneCoord } from '../../lib/zones';
import type { WorldMap } from '../../lib/worldMap';
import type { WorkerState } from '../types';
import { ALL_CHARACTERS } from '../../data/startup-characters';
import { characters } from '../../data/characters';
import { deriveAction } from '../actions/derive-action';
import { resolveSpatial } from '../hooks/use-spatial-bridge';
import { getOverride, getRotationOverride, useOverridesVersion } from '../debug/position-overrides';
import { useSpritesheet } from '../hooks/use-spritesheet';
import { buildWalkableGrid, findPath, type Tile } from '../lib/pathfinding';
import { CharacterSprite } from './CharacterSprite';
import { CharacterShadow } from './CharacterShadow';
import { SpotlightGlow } from './SpotlightGlow';
import { RoleLabel } from './RoleLabel';
import { ToolIndicator } from './ToolIndicator';
import { ThinkingIndicator } from './ThinkingIndicator';
import { SpeechBubble } from './SpeechBubble';
import { ZoneHighlight } from './ZoneHighlight';
import { WalkTrail } from './WalkTrail';
import { CelebrationParticles } from './CelebrationParticles';

const MOVE_SPEED = 1.5; // tiles per second
type Orientation = 'up' | 'down' | 'left' | 'right';

interface WorkerRendererProps {
  agent: AgentState;
  zones: Record<string, ZoneCoord>;
  workStations: Record<string, ZoneCoord>;
  meetPoint: ZoneCoord | null;
  isActive?: boolean;
  celebration: boolean;
  map: WorldMap;
  /** Character ID of another agent currently walking up to this one
   *  (typically the CEO during a handoff). When set, this character
   *  faces the approaching peer instead of idling toward the viewer. */
  approachingPeerId?: string | null;
}

function tileToPixel(t: Tile, tileDim: number): { x: number; y: number } {
  return {
    x: t.x * tileDim + tileDim / 2,
    y: t.y * tileDim + tileDim / 2,
  };
}

function pixelToTile(p: { x: number; y: number }, tileDim: number): Tile {
  return {
    x: Math.round((p.x - tileDim / 2) / tileDim),
    y: Math.round((p.y - tileDim / 2) / tileDim),
  };
}

function headingFromPixelDelta(dx: number, dy: number): Orientation | null {
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return null;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}

export function WorkerRenderer({
  agent,
  zones,
  workStations,
  meetPoint,
  isActive = false,
  celebration,
  map,
  approachingPeerId = null,
}: WorkerRendererProps) {
  // Subscribe to debug-overlay position overrides. When the author
  // drags this character's yellow dot to a new tile, the store bumps
  // `version` and the effective idle position below swaps in the
  // override instead of the static coord from startup-characters.ts.
  useOverridesVersion();
  const baseCharDef = ALL_CHARACTERS.get(agent.characterId);
  const override = getOverride(agent.characterId);
  const charDef = baseCharDef
    ? override
      ? { ...baseCharDef, idlePosition: override }
      : baseCharDef
    : undefined;
  const spriteName = charDef?.sprite ?? 'f1';
  const spriteData = characters.find((c) => c.name === spriteName);

  const spritesheet = useSpritesheet(
    spriteData?.textureUrl ?? '/assets/32x32folk.png',
    spriteData?.spritesheetData ?? characters[0].spritesheetData,
  );

  // Last-arrived tile position — informs the spatial bridge's orientation for
  // the first leg after a goal change (until the path takes over).
  const prevTilePos = useRef<Tile>(
    charDef?.idlePosition ?? { x: 0, y: 0 },
  );

  const peerDef = agent.handoffPeer ? ALL_CHARACTERS.get(agent.handoffPeer) ?? null : null;
  const approachingPeerDef = approachingPeerId
    ? ALL_CHARACTERS.get(approachingPeerId) ?? null
    : null;
  const workerState: WorkerState = resolveSpatial({
    agent,
    character: charDef ?? { id: agent.characterId, role: '', sprite: 'f1', screen: 'boardroom', idlePosition: { x: 0, y: 0 } },
    peerDef,
    zones,
    workStations,
    meetPoint,
    prevPosition: prevTilePos.current,
    celebration,
    approachingPeerDef,
    blockedTiles: map.blockedTiles,
  });

  const action = deriveAction(workerState, celebration);

  const goalTile: Tile = workerState.targetPosition ?? workerState.position;

  // All position state lives in refs — the tick loop mutates them and only
  // flips React state when `isMoving`/`heading` actually change.
  const lastGoalRef = useRef<Tile>(goalTile);
  const pathRef = useRef<Tile[]>([]);
  const currentWaypointRef = useRef<Tile>(goalTile);
  const targetPxRef = useRef(tileToPixel(goalTile, map.tileDim));
  const posRef = useRef({ ...targetPxRef.current });
  const containerRef = useRef<PIXI.Container>(null);
  const bobPhase = useRef(Math.random() * Math.PI * 2);
  const prevActiveRef = useRef(false);
  const flashPhase = useRef(0);
  const isFlashing = useRef(false);
  const isMovingRef = useRef(false);
  const headingRef = useRef<Orientation>(workerState.orientation);
  const [isMoving, setIsMoving] = useState(false);
  const [heading, setHeading] = useState<Orientation>(workerState.orientation);
  const [showDescription, setShowDescription] = useState(false);
  const hideDescTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (hideDescTimerRef.current) clearTimeout(hideDescTimerRef.current);
    },
    [],
  );

  const handleTap = useCallback(() => {
    if (!charDef?.description) return;
    setShowDescription((visible) => {
      if (hideDescTimerRef.current) {
        clearTimeout(hideDescTimerRef.current);
        hideDescTimerRef.current = null;
      }
      const next = !visible;
      if (next) {
        hideDescTimerRef.current = setTimeout(() => {
          setShowDescription(false);
          hideDescTimerRef.current = null;
        }, 5000);
      }
      return next;
    });
  }, [charDef?.description]);

  // Re-path when the goal tile changes. Runs during render — pure ref writes,
  // idempotent on a given commit. `findPath` is a BFS on a 30×16 grid so it's
  // cheap enough to inline without a useEffect + extra render.
  if (
    goalTile.x !== lastGoalRef.current.x ||
    goalTile.y !== lastGoalRef.current.y
  ) {
    lastGoalRef.current = goalTile;

    // Block every other boardroom/factory character's home tile so paths
    // route around occupied seats. The goal tile itself is excluded — if a
    // character is delegated *to* another character's home (e.g. Scout's
    // research nook is also the GOOGLE_SEARCH zone), Scout isn't standing
    // there right now and routing must be allowed to end on that tile.
    const blocked: Tile[] = [];
    for (const c of ALL_CHARACTERS.values()) {
      if (c.id === agent.characterId) continue;
      if (c.screen !== charDef?.screen) continue;
      if (c.idlePosition.x === goalTile.x && c.idlePosition.y === goalTile.y) continue;
      blocked.push(c.idlePosition);
    }

    const grid = buildWalkableGrid(map, blocked);
    const startTile = pixelToTile(posRef.current, map.tileDim);
    pathRef.current = findPath(grid, startTile, goalTile);

    const next = pathRef.current[0] ?? goalTile;
    currentWaypointRef.current = next;
    targetPxRef.current = tileToPixel(next, map.tileDim);
  }

  useTick(
    useCallback(
      (ticker: { deltaTime: number }) => {
        const delta = ticker.deltaTime;
        const c = containerRef.current;
        if (!c) return;

        const target = targetPxRef.current;
        const cur = posRef.current;

        const dx = target.x - cur.x;
        const dy = target.y - cur.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const stepping = dist > 1;

        if (stepping) {
          const dt = delta / 60;
          const step = MOVE_SPEED * map.tileDim * dt;
          const ratio = Math.min(step / dist, 1);
          posRef.current = {
            x: cur.x + dx * ratio,
            y: cur.y + dy * ratio,
          };
        } else if (dist > 0) {
          // Arrived at current waypoint — snap, then pop it and advance.
          posRef.current = { ...target };
          prevTilePos.current = { ...currentWaypointRef.current };

          if (pathRef.current.length > 0) pathRef.current.shift();

          const nextWaypoint = pathRef.current[0];
          if (nextWaypoint) {
            currentWaypointRef.current = nextWaypoint;
            targetPxRef.current = tileToPixel(nextWaypoint, map.tileDim);
          }
        }

        const walking = stepping || pathRef.current.length > 0;
        if (walking !== isMovingRef.current) {
          isMovingRef.current = walking;
          setIsMoving(walking);
        }

        // Orientation tracks the direction to the current waypoint so the
        // sprite turns at every corner in the path.
        if (walking) {
          const nextHeading = headingFromPixelDelta(
            targetPxRef.current.x - posRef.current.x,
            targetPxRef.current.y - posRef.current.y,
          );
          if (nextHeading && nextHeading !== headingRef.current) {
            headingRef.current = nextHeading;
            setHeading(nextHeading);
          }
        }

        c.x = posRef.current.x;

        // Idle bob (only when fully stationary — stepping OR queued waypoints
        // mean we're still walking).
        if (!walking) {
          bobPhase.current += delta * 0.06;
          const bobOffset = Math.sin(bobPhase.current);
          const thinkBounce =
            action.type === 'think' ? Math.sin(bobPhase.current * 2) * 0.5 : 0;
          c.y = posRef.current.y + bobOffset + thinkBounce;
        } else {
          c.y = posRef.current.y;
        }

        if (isActive && !prevActiveRef.current) {
          isFlashing.current = true;
          flashPhase.current = 0;
        }
        prevActiveRef.current = isActive;

        if (isFlashing.current) {
          flashPhase.current += delta * 0.12;
          if (flashPhase.current >= Math.PI) {
            isFlashing.current = false;
            c.scale.set(1, 1);
            c.alpha = 1;
          } else {
            const pulse = Math.sin(flashPhase.current) * 0.15;
            c.scale.set(1 + pulse, 1 + pulse);
            c.alpha = 0.7 + Math.sin(flashPhase.current) * 0.3;
          }
        }
      },
      [action.type, isActive, map.tileDim],
    ),
  );

  const effectiveActionType = isMoving ? ('move' as const) : action.type;

  // Idle-facing priority:
  //   1. Debug runtime override (arrow-keys in the overlay).
  //   2. Spatial bridge's computed orientation during a handoff —
  //      either this character is the sender (`agent.handoffPeer` set)
  //      or someone else is walking up to them (`approachingPeerId`).
  //      That's how both sides end up looking at each other.
  //   3. Character's defaultOrientation from boardroom-stations.json.
  //   4. Spatial bridge's computed orientation as a last resort.
  // Moving sprites always follow their path heading so walk direction
  // stays correct.
  const rotationOverride = getRotationOverride(agent.characterId);
  const inHandoff = Boolean(agent.handoffPeer) || Boolean(approachingPeerId);
  const idleOrientation =
    rotationOverride ??
    (inHandoff
      ? workerState.orientation
      : charDef?.defaultOrientation ?? workerState.orientation);
  const effectiveOrientation =
    action.type === 'think' || action.type === 'celebrate'
      ? ('down' as const)
      : isMoving
        ? heading
        : idleOrientation;

  if (!spritesheet) return null;

  return (
    <>
      <pixiContainer
        ref={containerRef}
        eventMode="static"
        cursor="pointer"
        onPointerTap={handleTap}
        zIndex={agent.isSpeaking ? 100 : isActive ? 50 : 0}
      >
        <CharacterShadow scale={map.tileDim / 32} />
        {isActive && <SpotlightGlow />}
        {charDef && !(agent.isSpeaking && agent.speechBubble) && !showDescription && (
          <RoleLabel
            label={charDef.role}
            isActive={isActive}
            yOffset={-map.tileDim}
          />
        )}
        <CharacterSprite
          spritesheet={spritesheet}
          orientation={effectiveOrientation}
          actionType={effectiveActionType}
          speed={spriteData?.speed}
          scale={map.tileDim / 32}
        />
        {agent.isThinking && !agent.isSpeaking && <ThinkingIndicator />}
        {agent.isSpeaking && agent.speechBubble && (
          <SpeechBubble
            text={agent.speechBubble}
            isStreaming={true}
            name={charDef?.role}
            charX={posRef.current.x}
            charY={posRef.current.y}
            worldW={map.width * map.tileDim}
            worldH={map.height * map.tileDim}
          />
        )}
        {showDescription &&
          charDef?.description &&
          !(agent.isSpeaking && agent.speechBubble) && (
            <SpeechBubble
              text={charDef.description}
              isStreaming={false}
              name={charDef.role}
              charX={posRef.current.x}
              charY={posRef.current.y}
              worldW={map.width * map.tileDim}
              worldH={map.height * map.tileDim}
            />
          )}
        {agent.currentTool && <ToolIndicator toolName={agent.currentTool} />}
        {action.type === 'celebrate' && <CelebrationParticles />}
      </pixiContainer>

      {isMoving && <WalkTrail posRef={posRef} />}
      {agent.currentTool && workerState.targetPosition && (
        <ZoneHighlight
          x={workerState.targetPosition.x}
          y={workerState.targetPosition.y}
          tileDim={map.tileDim}
        />
      )}
    </>
  );
}
