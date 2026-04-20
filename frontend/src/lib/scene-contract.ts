/**
 * Renderer-agnostic scene contract.
 *
 * These interfaces define the props that any canvas renderer (pixi, CSS/DOM,
 * canvas2d, three.js, etc.) must accept. Screen components depend ONLY on
 * these types — never on a concrete renderer.
 *
 * The scene receives semantic AgentState and is responsible for resolving
 * spatial positions internally using zone configuration.
 *
 * Note: the factory no longer uses a Pixi scene — it is rendered via an
 * embedded agent-flow iframe. Only the boardroom is contracted here.
 */

import type { ComponentType } from 'react';
import type { WorldMap } from './worldMap';
import type { AgentState } from '../hooks/ag-ui/types';

/** Props accepted by the boardroom scene renderer. */
export interface BoardroomSceneProps {
  map: WorldMap;
  agents: Map<string, AgentState>;
  celebration: boolean;
  screenW: number;
  screenH: number;
  phaseBanner?: string | null;
}

/** A React component type that fulfils the boardroom scene contract. */
export type BoardroomSceneComponent = ComponentType<BoardroomSceneProps>;

/** Bundle of scene implementations — swap the entire renderer in one object. */
export interface SceneImplementation {
  BoardroomScene: BoardroomSceneComponent;
}
