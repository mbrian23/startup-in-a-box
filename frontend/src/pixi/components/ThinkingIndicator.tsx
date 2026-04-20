'use client';

/**
 * ThinkingIndicator — animated thought bubble that bobs above the character.
 * Uses useTick for smooth vertical oscillation so it's visible at any zoom.
 */

import { useRef, useCallback } from 'react';
import { useTick } from '@pixi/react';
import type * as PIXI from 'pixi.js';

export function ThinkingIndicator() {
  const graphicsRef = useRef<PIXI.Graphics | null>(null);
  const phase = useRef(0);

  useTick(
    useCallback((ticker: { deltaTime: number }) => {
      const g = graphicsRef.current;
      if (!g) return;
      g.clear();
      phase.current += ticker.deltaTime * 0.06;

      const bobY = Math.sin(phase.current) * 3;
      const pulse = 0.6 + Math.sin(phase.current * 1.5) * 0.2;

      // Three rising dots (thought bubble style)
      g.circle(-2, -22 + bobY, 2).fill({ color: 0xaaccff, alpha: pulse * 0.5 });
      g.circle(2, -28 + bobY, 3).fill({ color: 0xaaccff, alpha: pulse * 0.6 });
      g.circle(-1, -36 + bobY, 5).fill({ color: 0xaaccff, alpha: pulse * 0.7 });

      // Main thought cloud
      g.roundRect(-14, -54 + bobY, 28, 16, 8).fill({ color: 0xaaccff, alpha: pulse * 0.5 });
      g.roundRect(-10, -50 + bobY, 20, 8, 4).fill({ color: 0xddeeff, alpha: pulse * 0.3 });
    }, []),
  );

  const draw = useCallback((g: PIXI.Graphics) => {
    graphicsRef.current = g;
  }, []);

  return <pixiGraphics draw={draw} />;
}
