/**
 * Pixi-layer spatial types.
 *
 * WorkerState extends AgentState with position/movement data.
 * Only the pixi renderer consumes these — no React screen component
 * or AG-UI hook should import from this file.
 */

import type { AgentState } from '../hooks/ag-ui/types';

export interface SpatialState {
  position: { x: number; y: number };
  targetPosition: { x: number; y: number } | null;
  orientation: 'up' | 'down' | 'left' | 'right';
  isMoving: boolean;
}

export type WorkerState = AgentState & SpatialState;
