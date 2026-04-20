/**
 * Spatial bridge — maps semantic AgentState to spatial WorkerState.
 *
 * This is the ONLY place that resolves "agent is using tool X" into
 * "character should walk to coordinate (x, y)". The AG-UI layer
 * never touches coordinates.
 */

import type { AgentState } from '../../hooks/ag-ui/types';
import type { ZoneCoord } from '../../lib/zones';
import type { StartupCharacter } from '../../data/startup-characters';
import type { WorkerState } from '../types';

export function orientationFromDelta(
  from: { x: number; y: number },
  to: { x: number; y: number },
): 'up' | 'down' | 'left' | 'right' {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 'right' : 'left';
  }
  return dy > 0 ? 'down' : 'up';
}

/**
 * Find the best cardinal neighbor of `target` for the character to
 * stand on during a handoff, preferring the axis closest to `from`.
 */
function neighborFacing(
  from: { x: number; y: number },
  target: { x: number; y: number },
  blocked?: ReadonlySet<string>,
): { x: number; y: number } {
  const dx = target.x - from.x;
  const dy = target.y - from.y;
  const primaryAxis = Math.abs(dy) >= Math.abs(dx) ? 'y' : 'x';
  const candidates: { x: number; y: number }[] =
    primaryAxis === 'y'
      ? [
          { x: target.x, y: target.y + (dy <= 0 ? 1 : -1) },
          { x: target.x + (dx <= 0 ? 1 : -1), y: target.y },
          { x: target.x + (dx <= 0 ? -1 : 1), y: target.y },
          { x: target.x, y: target.y + (dy <= 0 ? -1 : 1) },
        ]
      : [
          { x: target.x + (dx <= 0 ? 1 : -1), y: target.y },
          { x: target.x, y: target.y + (dy <= 0 ? 1 : -1) },
          { x: target.x, y: target.y + (dy <= 0 ? -1 : 1) },
          { x: target.x + (dx <= 0 ? -1 : 1), y: target.y },
        ];
  if (!blocked || blocked.size === 0) return candidates[0];
  return candidates.find((c) => !blocked.has(`${c.x},${c.y}`)) ?? candidates[0];
}

export interface ResolveSpatialConfig {
  agent: AgentState;
  character: StartupCharacter;
  peerDef: StartupCharacter | null;
  zones: Record<string, ZoneCoord>;
  workStations: Record<string, ZoneCoord>;
  meetPoint: ZoneCoord | null;
  prevPosition: { x: number; y: number };
  celebration: boolean;
  approachingPeerDef?: StartupCharacter | null;
  blockedTiles?: ReadonlySet<string>;
}

/**
 * Pure function: resolves an AgentState + zone config into a full WorkerState.
 *
 * Priority for targetPosition:
 *   1. celebration + no current tool → walk back to idle position
 *   2. handoffPeer (CEO) → walk to neighbor tile of peer's desk
 *   3. handoffPeer (specialist) → stay home, face peer
 *   4. currentTool with known zone → walk to tool zone
 *   5. otherwise → walk back to idle position
 */
export function resolveSpatial(config: ResolveSpatialConfig): WorkerState {
  const { agent, character, peerDef, zones, workStations, meetPoint, prevPosition, celebration, approachingPeerDef, blockedTiles } = config;

  let targetPosition: { x: number; y: number } | null = null;

  if (celebration && !agent.currentTool) {
    targetPosition = { x: character.idlePosition.x, y: character.idlePosition.y };
  } else if (agent.handoffPeer && peerDef) {
    if (agent.characterId === 'ceo') {
      // CEO walks to the tile adjacent to the peer's desk
      targetPosition = neighborFacing(character.idlePosition, peerDef.idlePosition, blockedTiles);
    } else {
      // Specialists stay at their desk and face the peer
      targetPosition = { x: character.idlePosition.x, y: character.idlePosition.y };
    }
  } else if (agent.handoffPeer) {
    const mp = meetPoint ?? workStations[agent.characterId] ?? null;
    targetPosition = mp ? { x: mp.x, y: mp.y } : { x: character.idlePosition.x, y: character.idlePosition.y };
  } else if (agent.currentTool && Object.hasOwn(zones, agent.currentTool)) {
    const zone = zones[agent.currentTool];
    targetPosition = { x: zone.x, y: zone.y };
  } else {
    targetPosition = { x: character.idlePosition.x, y: character.idlePosition.y };
  }

  const isMoving = targetPosition !== null;

  // Face the peer during a handoff
  const facePeer = approachingPeerDef ?? peerDef;
  const faceTarget = agent.handoffPeer && facePeer ? facePeer.idlePosition : null;
  const orientation = targetPosition
    ? orientationFromDelta(prevPosition, targetPosition)
    : faceTarget
      ? orientationFromDelta(prevPosition, faceTarget)
      : 'down';

  return {
    ...agent,
    position: prevPosition,
    targetPosition,
    isMoving,
    orientation,
  };
}
