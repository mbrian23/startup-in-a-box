'use client';

/**
 * PowerOnSweep — horizontal scan line effect when the factory powers on.
 * A bright line sweeps left-to-right across the screen.
 */

import { useRef, useCallback } from 'react';
import { useTick } from '@pixi/react';
import type * as PIXI from 'pixi.js';

interface PowerOnSweepProps {
  worldW: number;
  worldH: number;
  active: boolean;
  color?: number;
}

export function PowerOnSweep({ worldW, worldH, active, color = 0x5888dd }: PowerOnSweepProps) {
  const graphicsRef = useRef<PIXI.Graphics | null>(null);
  const progress = useRef(0);
  const wasActive = useRef(false);

  useTick(
    useCallback(
      (ticker: { deltaTime: number }) => {
        const g = graphicsRef.current;
        if (!g) return;
        g.clear();

        // Reset on activation edge
        if (active && !wasActive.current) {
          progress.current = 0;
        }
        wasActive.current = active;

        if (!active && progress.current <= 0) return;
        if (progress.current > 1.2) return; // fully swept

        progress.current += ticker.deltaTime * 0.012;
        const x = progress.current * worldW;
        const alpha = Math.max(0, 1 - (progress.current - 1) * 5); // fade out at end

        // Main sweep line
        g.rect(x - 2, 0, 4, worldH).fill({ color, alpha: alpha * 0.8 });
        // Glow trail
        g.rect(x - 20, 0, 20, worldH).fill({ color, alpha: alpha * 0.15 });
        // Leading edge glow
        g.rect(x, 0, 8, worldH).fill({ color: 0xffffff, alpha: alpha * 0.3 });
      },
      [worldW, worldH, active, color],
    ),
  );

  const draw = useCallback((g: PIXI.Graphics) => {
    graphicsRef.current = g;
  }, []);

  return <pixiGraphics draw={draw} />;
}
