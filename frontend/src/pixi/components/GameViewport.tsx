'use client';

/**
 * GameViewport — declarative pixi-viewport wrapper using @pixi/react extend.
 * Provides drag/pinch/wheel/zoom via ref + useEffect after mount.
 */

import { useCallback, useEffect, useState, type ReactNode } from 'react';

import { useApplication } from '@pixi/react';
import type { Viewport } from 'pixi-viewport';

interface GameViewportProps {
  screenW: number;
  screenH: number;
  worldW: number;
  worldH: number;
  children: ReactNode;
}

export function GameViewport({ screenW, screenH, worldW, worldH, children }: GameViewportProps) {
  const { app } = useApplication();
  // Callback ref promoted to state so the fit-effect reruns when the
  // viewport actually mounts (first render often happens before the ref
  // attaches, and the `app` object reference is stable so a dep-based
  // effect would never retrigger).
  const [vp, setVp] = useState<Viewport | null>(null);
  const vpRef = useCallback((node: Viewport | null) => setVp(node), []);
  const renderer = app?.renderer ?? null;

  useEffect(() => {
    if (!vp || !renderer) return;

    if (!vp.plugins.get('drag')) {
      vp.drag().pinch({}).wheel({ smooth: 3, percent: 0.1 }).decelerate()
        .clamp({ direction: 'all', underflow: 'center' });
    }

    const raf = requestAnimationFrame(() => {
      vp.resize(screenW, screenH, worldW, worldH);
      const fitScale = Math.min(screenW / worldW, screenH / worldH);
      vp.clampZoom({ minScale: fitScale * 0.5, maxScale: 4.0 });
      vp.setZoom(fitScale, true);
      vp.moveCenter(worldW / 2, worldH / 2);
    });
    return () => cancelAnimationFrame(raf);
  }, [vp, renderer, screenW, screenH, worldW, worldH]);

  if (!renderer) return null;

  return (
    <pixiViewport
      ref={vpRef}
      screenWidth={screenW}
      screenHeight={screenH}
      worldWidth={worldW}
      worldHeight={worldH}
      events={renderer.events}
      passiveWheel={false}
    >
      {children}
    </pixiViewport>
  );
}
