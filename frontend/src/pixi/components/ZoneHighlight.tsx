'use client';

/**
 * ZoneHighlight — pulsing rounded rect at a tool zone tile.
 *
 * `tileDim` is passed in from the map so the highlight scales with the
 * scene's tile size (boardroom: 48, factory: 32).
 */

import { useRef, useCallback } from 'react';
import { useTick } from '@pixi/react';
import type * as PIXI from 'pixi.js';

export function ZoneHighlight({ x, y, tileDim }: { x: number; y: number; tileDim: number }) {
  const graphicsRef = useRef<PIXI.Graphics | null>(null);
  const phase = useRef(0);

  useTick(
    useCallback(
      (ticker: { deltaTime: number }) => {
        const g = graphicsRef.current;
        if (!g) return;
        g.clear();
        phase.current += ticker.deltaTime * 0.08;
        const pulse = 0.15 + Math.sin(phase.current) * 0.1;
        g.roundRect(x * tileDim - 4, y * tileDim - 4, tileDim + 8, tileDim + 8, 4)
          .fill({ color: 0x44aaff, alpha: pulse });
      },
      [x, y, tileDim],
    ),
  );

  const draw = useCallback((g: PIXI.Graphics) => {
    graphicsRef.current = g;
  }, []);

  return <pixiGraphics draw={draw} />;
}
