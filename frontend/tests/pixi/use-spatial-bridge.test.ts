/**
 * Spatial bridge tests — pixi-layer coordinate resolution.
 *
 * Pure function tests, no React. Verifies that AgentState + zone config
 * correctly resolves to WorkerState spatial fields.
 */

import { describe, it, expect } from 'vitest';
import { resolveSpatial, orientationFromDelta } from '../../src/pixi/hooks/use-spatial-bridge';
import type { AgentState } from '../../src/hooks/ag-ui/types';
import type { StartupCharacter } from '../../src/data/startup-characters';
import type { ZoneCoord } from '../../src/lib/zones';

const mockCharacter: StartupCharacter = {
  id: 'scout',
  role: 'Scout',
  sprite: 'f5',
  screen: 'boardroom',
  idlePosition: { x: 13, y: 11 },
};

const zones: Record<string, ZoneCoord> = {
  Write: { x: 3, y: 5 },
  GoogleSearch: { x: 10, y: 5 },
  Bash: { x: 12, y: 8 },
};

const workStations: Record<string, ZoneCoord> = {
  scout: { x: 3, y: 6 },
};

const meetPoint: ZoneCoord = { x: 11, y: 9 };

function makeAgent(overrides: Partial<AgentState> = {}): AgentState {
  return {
    characterId: 'scout',
    currentTool: null,
    isThinking: false,
    isSpeaking: false,
    speechBubble: null,
    handoffPeer: null,
    ...overrides,
  };
}

const mockPeer: StartupCharacter = {
  id: 'blueprint',
  role: 'Blueprint',
  sprite: 'f6',
  screen: 'boardroom',
  idlePosition: { x: 5, y: 3 },
};

function cfg(overrides: Partial<Parameters<typeof resolveSpatial>[0]> = {}) {
  return {
    agent: makeAgent(),
    character: mockCharacter,
    peerDef: null,
    zones,
    workStations,
    meetPoint,
    prevPosition: { x: 10, y: 8 },
    celebration: false,
    ...overrides,
  };
}

describe('resolveSpatial', () => {
  it('B1: tool with known zone sets targetPosition', () => {
    const result = resolveSpatial(cfg({ agent: makeAgent({ currentTool: 'Write' }) }));
    expect(result.targetPosition).toEqual({ x: 3, y: 5 });
    expect(result.isMoving).toBe(true);
  });

  it('B2: tool with unknown zone falls through to idle (go home)', () => {
    const result = resolveSpatial(cfg({ agent: makeAgent({ currentTool: 'FakeTool' }) }));
    expect(result.targetPosition).toEqual({ x: 13, y: 11 });
    expect(result.isMoving).toBe(true);
  });

  it('B3: no current tool returns to idle (return after handoff)', () => {
    const result = resolveSpatial(cfg());
    expect(result.targetPosition).toEqual({ x: 13, y: 11 });
    expect(result.isMoving).toBe(true);
  });

  it('B4: celebration walk-back to idle position', () => {
    const result = resolveSpatial(cfg({ prevPosition: { x: 3, y: 5 }, celebration: true }));
    expect(result.targetPosition).toEqual({ x: 13, y: 11 });
    expect(result.isMoving).toBe(true);
  });

  it('B5: non-CEO handoff stays at home and faces the peer', () => {
    const result = resolveSpatial(cfg({ agent: makeAgent({ handoffPeer: 'blueprint' }), peerDef: mockPeer }));
    expect(result.targetPosition).toEqual({ x: 13, y: 11 });
    expect(result.isMoving).toBe(true);
  });

  it('specialist receiving from CEO faces the CEO', () => {
    const ceo: StartupCharacter = { id: 'ceo', role: 'Theo · CEO', sprite: 'f2', screen: 'boardroom', idlePosition: { x: 6, y: 3 } };
    const visionary: StartupCharacter = { id: 'visionary', role: 'Rin · Product Strategy', sprite: 'f1', screen: 'boardroom', idlePosition: { x: 4, y: 6 } };
    const result = resolveSpatial(cfg({
      agent: makeAgent({ characterId: 'visionary', handoffPeer: 'ceo' }),
      character: visionary,
      peerDef: ceo,
      prevPosition: visionary.idlePosition,
      blockedTiles: new Set(['4,5']),
    }));
    expect(result.targetPosition).toEqual(visionary.idlePosition);
  });

  it('CEO handoff walks to the primary-axis neighbor when it is walkable', () => {
    const ceo: StartupCharacter = { id: 'ceo', role: 'Theo · CEO', sprite: 'f2', screen: 'boardroom', idlePosition: { x: 6, y: 3 } };
    const specialist: StartupCharacter = { id: 'strategist', role: 'Strategist', sprite: 'f4', screen: 'boardroom', idlePosition: { x: 6, y: 8 } };
    const result = resolveSpatial(cfg({
      agent: makeAgent({ characterId: 'ceo', handoffPeer: 'strategist' }),
      character: ceo,
      peerDef: specialist,
      prevPosition: ceo.idlePosition,
    }));
    expect(result.targetPosition).toEqual({ x: 6, y: 7 });
    expect(result.orientation).toBe('down');
  });

  it('CEO handoff routes around a blocked neighbor', () => {
    const ceo: StartupCharacter = { id: 'ceo', role: 'Theo · CEO', sprite: 'f2', screen: 'boardroom', idlePosition: { x: 6, y: 3 } };
    const specialist: StartupCharacter = { id: 'strategist', role: 'Strategist', sprite: 'f4', screen: 'boardroom', idlePosition: { x: 6, y: 8 } };
    const result = resolveSpatial(cfg({
      agent: makeAgent({ characterId: 'ceo', handoffPeer: 'strategist' }),
      character: ceo,
      peerDef: specialist,
      prevPosition: ceo.idlePosition,
      blockedTiles: new Set(['6,7']),
    }));
    expect(result.targetPosition).not.toEqual({ x: 6, y: 7 });
    const neighbors = [{ x: 5, y: 8 }, { x: 7, y: 8 }, { x: 6, y: 9 }];
    expect(neighbors).toContainEqual(result.targetPosition);
  });

  it('approached specialist faces the approaching peer', () => {
    const ceo: StartupCharacter = { id: 'ceo', role: 'Theo · CEO', sprite: 'f2', screen: 'boardroom', idlePosition: { x: 6, y: 3 } };
    const strategist: StartupCharacter = { id: 'strategist', role: 'Strategist', sprite: 'f4', screen: 'boardroom', idlePosition: { x: 10, y: 8 } };
    const result = resolveSpatial(cfg({
      agent: makeAgent({ characterId: 'strategist' }),
      character: strategist,
      prevPosition: strategist.idlePosition,
      approachingPeerDef: ceo,
    }));
    expect(result.targetPosition).toEqual(strategist.idlePosition);
  });

  it('handoff with no peer character falls back to global meetPoint', () => {
    const result = resolveSpatial(cfg({ agent: makeAgent({ handoffPeer: 'blueprint' }) }));
    expect(result.targetPosition).toEqual({ x: 11, y: 9 });
  });

  it('handoff without meetPoint or peer falls back to workStation', () => {
    const result = resolveSpatial(cfg({ agent: makeAgent({ handoffPeer: 'blueprint' }), meetPoint: null }));
    expect(result.targetPosition).toEqual({ x: 3, y: 6 });
  });

  it('preserves semantic fields in output', () => {
    const result = resolveSpatial(cfg({ agent: makeAgent({ currentTool: 'Write', isThinking: false, isSpeaking: true, speechBubble: 'hi' }) }));
    expect(result.characterId).toBe('scout');
    expect(result.currentTool).toBe('Write');
    expect(result.isSpeaking).toBe(true);
    expect(result.speechBubble).toBe('hi');
  });
});

describe('orientationFromDelta', () => {
  it('B6: orientation left when target is to the left', () => {
    expect(orientationFromDelta({ x: 10, y: 5 }, { x: 3, y: 5 })).toBe('left');
  });

  it('B7: orientation up when target is above', () => {
    expect(orientationFromDelta({ x: 3, y: 8 }, { x: 3, y: 5 })).toBe('up');
  });

  it('B8: orientation down when target is below', () => {
    expect(orientationFromDelta({ x: 3, y: 2 }, { x: 3, y: 5 })).toBe('down');
  });

  it('B9: orientation right when target is to the right', () => {
    expect(orientationFromDelta({ x: 3, y: 5 }, { x: 10, y: 5 })).toBe('right');
  });

  it('dominant axis wins for diagonal movement', () => {
    expect(orientationFromDelta({ x: 3, y: 5 }, { x: 10, y: 8 })).toBe('right');
    expect(orientationFromDelta({ x: 3, y: 5 }, { x: 5, y: 10 })).toBe('down');
  });
});
