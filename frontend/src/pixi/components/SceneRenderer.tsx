'use client';

/**
 * SceneRenderer — composes TileMap + Ambient + Workers inside a GameViewport.
 *
 * Receives semantic AgentState from the AG-UI layer and passes it along with
 * zone configuration to each WorkerRenderer, which owns spatial resolution.
 */

import type { WorldMap } from '../../lib/worldMap';
import type { AgentState } from '../../hooks/ag-ui/types';
import type { ZoneCoord } from '../../lib/zones';
import { GameViewport } from './GameViewport';
import { TileMapRenderer } from './TileMapRenderer';
import { AmbientParticles } from './AmbientParticles';
import { WorkerRenderer } from './WorkerRenderer';
import { PhaseBanner } from './PhaseBanner';
import { PowerOnSweep } from './PowerOnSweep';
import { TileDebugOverlay } from './TileDebugOverlay';
import { useDebugMode } from '../debug/debug-mode';

interface SceneRendererProps {
  map: WorldMap;
  agents: Map<string, AgentState>;
  celebration: boolean;
  zones: Record<string, ZoneCoord>;
  workStations: Record<string, ZoneCoord>;
  meetPoint?: ZoneCoord | null;
  ambientVariant: 'warm' | 'cool';
  screenW: number;
  screenH: number;
  phaseBanner?: string | null;
  powerOnActive?: boolean;
  showDebug?: boolean;
}

export function SceneRenderer({
  map,
  agents,
  celebration,
  zones,
  workStations,
  meetPoint,
  ambientVariant,
  screenW,
  screenH,
  phaseBanner,
  powerOnActive,
  showDebug: showDebugProp = false,
}: SceneRendererProps) {
  // Debug toggle lives in a shared store (see `debug/debug-mode.ts`)
  // so both this Pixi overlay and the HTML OverridesPanel flip in
  // lockstep on the `G` key. The hotkey listener is installed at the
  // top of BoardroomScreen.
  const debugMode = useDebugMode();
  const showDebug = showDebugProp || debugMode;

  const worldW = map.width * map.tileDim;
  const worldH = map.height * map.tileDim;

  const agentEntries = Array.from(agents.entries());

  // Determine which agent is currently active (thinking, speaking, or using a tool)
  const activeAgentId = agentEntries.find(
    ([, a]) => a.isThinking || a.isSpeaking || a.currentTool,
  )?.[0] ?? null;

  // `approachingBy` is populated ONLY during a real handoff — if X has
  // `handoffPeer = Y`, then Y sees X as approaching. Otherwise the
  // specialist falls back to their authored `defaultOrientation` which
  // already looks toward the CEO's desk.
  const approachingBy = new Map<string, string>();
  for (const [id, a] of agentEntries) {
    if (a.handoffPeer) approachingBy.set(a.handoffPeer, id);
  }

  return (
    <GameViewport screenW={screenW} screenH={screenH} worldW={worldW} worldH={worldH}>
      <TileMapRenderer map={map} />
      <AmbientParticles worldW={worldW} worldH={worldH} variant={ambientVariant} />
      {/* sortableChildren lifts the speaking/active character above its peers,
          so a speech bubble never draws under another worker's role label. */}
      <pixiContainer sortableChildren={true}>
        {agentEntries.map(([id, agent]) => (
          <WorkerRenderer
            key={id}
            agent={agent}
            zones={zones}
            workStations={workStations}
            meetPoint={meetPoint ?? null}
            isActive={id === activeAgentId}
            celebration={celebration}
            map={map}
            approachingPeerId={approachingBy.get(id) ?? null}
          />
        ))}
      </pixiContainer>
      {powerOnActive !== undefined && (
        <PowerOnSweep worldW={worldW} worldH={worldH} active={!!powerOnActive} />
      )}
      <PhaseBanner text={phaseBanner ?? null} worldW={worldW} worldH={worldH} />
      {showDebug && <TileDebugOverlay map={map} />}
    </GameViewport>
  );
}
