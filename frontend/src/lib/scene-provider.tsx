'use client';

/**
 * SceneProvider — dependency injection for the canvas renderer.
 *
 * Wraps the app at a high level. Screen components call useSceneImpl()
 * to get whichever BoardroomScene implementation is active.
 *
 * Default: pixi.js renderer (lazy-loaded to keep the bundle split clean).
 * To swap: pass a different SceneImplementation to <SceneProvider impl={...}>.
 */

import { createContext, useContext, useMemo, lazy } from 'react';
import type { ReactNode } from 'react';
import type { SceneImplementation } from './scene-contract';

const PixiBoardroomScene = lazy(() =>
  import('../pixi/screens/BoardroomScene').then((m) => ({ default: m.BoardroomScene })),
);

const DEFAULT_IMPL: SceneImplementation = {
  BoardroomScene: PixiBoardroomScene,
};

const SceneContext = createContext<SceneImplementation>(DEFAULT_IMPL);

interface SceneProviderProps {
  impl?: SceneImplementation;
  children: ReactNode;
}

export function SceneProvider({ impl, children }: SceneProviderProps) {
  const value = useMemo(() => impl ?? DEFAULT_IMPL, [impl]);
  return <SceneContext.Provider value={value}>{children}</SceneContext.Provider>;
}

/** Get the active scene implementation. */
export function useSceneImpl(): SceneImplementation {
  return useContext(SceneContext);
}
