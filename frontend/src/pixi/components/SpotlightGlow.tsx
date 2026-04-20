'use client';

/**
 * SpotlightGlow — clearly marks the currently working agent with a pulsing
 * ground halo and a rotating ring of light dashes above the character.
 */

import { useRef, useCallback } from 'react';
import { useTick } from '@pixi/react';
import type * as PIXI from 'pixi.js';

export function SpotlightGlow() {
  const groundRef = useRef<PIXI.Graphics | null>(null);
  const ringRef = useRef<PIXI.Graphics | null>(null);
  const phase = useRef(0);

  useTick(
    useCallback((ticker: { deltaTime: number }) => {
      phase.current += ticker.deltaTime * 0.05;
      const pulse = 0.55 + Math.sin(phase.current) * 0.25;

      const ground = groundRef.current;
      if (ground) {
        ground.clear();
        // Wide soft halo on the floor
        ground.ellipse(0, 12, 46, 18).fill({ color: 0x66aaff, alpha: pulse * 0.35 });
        ground.ellipse(0, 12, 32, 13).fill({ color: 0x99ddff, alpha: pulse * 0.55 });
        ground.ellipse(0, 12, 18, 7).fill({ color: 0xddf2ff, alpha: pulse });
      }

      const ring = ringRef.current;
      if (ring) {
        ring.clear();
        // Rotating dashed ring around the character
        const cy = -6;
        const rx = 22;
        const ry = 10;
        const segments = 10;
        for (let i = 0; i < segments; i++) {
          const t = phase.current * 1.2 + (i / segments) * Math.PI * 2;
          const x = Math.cos(t) * rx;
          const y = cy + Math.sin(t) * ry;
          const depth = (Math.sin(t) + 1) / 2; // 0 back → 1 front
          ring
            .circle(x, y, 1.5 + depth)
            .fill({ color: 0x88ccff, alpha: 0.35 + depth * 0.55 });
        }
      }
    }, []),
  );

  const drawGround = useCallback((g: PIXI.Graphics) => {
    groundRef.current = g;
  }, []);

  const drawRing = useCallback((g: PIXI.Graphics) => {
    ringRef.current = g;
  }, []);

  return (
    <>
      <pixiGraphics draw={drawGround} />
      <pixiGraphics draw={drawRing} />
    </>
  );
}
