'use client';

/**
 * WalkTrail — particle dots behind a moving character.
 */

import { useRef, useCallback } from 'react';
import { useTick } from '@pixi/react';
import type * as PIXI from 'pixi.js';

interface TrailDot {
  x: number;
  y: number;
  life: number;
}

const MAX_TRAIL_DOTS = 12;

export function WalkTrail({ posRef }: { posRef: React.RefObject<{ x: number; y: number }> }) {
  const graphicsRef = useRef<PIXI.Graphics | null>(null);
  const dots = useRef<TrailDot[]>([]);
  const spawnTimer = useRef(0);

  useTick(
    useCallback(
      (ticker: { deltaTime: number }) => {
        const dt = ticker.deltaTime;
        const g = graphicsRef.current;
        if (!g) return;
        g.clear();

        // Spawn new dots
        if (posRef.current) {
          spawnTimer.current += dt;
          if (spawnTimer.current > 4) {
            spawnTimer.current = 0;
            dots.current.push({
              x: posRef.current.x + (Math.random() - 0.5) * 4,
              y: posRef.current.y + 10 + Math.random() * 4,
              life: 1.0,
            });
            if (dots.current.length > MAX_TRAIL_DOTS) {
              dots.current.shift();
            }
          }
        }

        // Update and draw
        const alive: TrailDot[] = [];
        for (const d of dots.current) {
          d.life -= 0.03 * dt;
          if (d.life > 0) {
            g.circle(d.x, d.y, 1.5 * d.life).fill({ color: 0xccccaa, alpha: d.life * 0.4 });
            alive.push(d);
          }
        }
        dots.current = alive;
      },
      [posRef],
    ),
  );

  const draw = useCallback((g: PIXI.Graphics) => {
    graphicsRef.current = g;
  }, []);

  return <pixiGraphics draw={draw} />;
}
