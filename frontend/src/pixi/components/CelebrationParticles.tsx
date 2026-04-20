'use client';

/**
 * CelebrationParticles — confetti burst on RUN_FINISHED.
 * Spawns colored particles that fall with gravity.
 */

import { useRef, useCallback } from 'react';
import { useTick } from '@pixi/react';
import type * as PIXI from 'pixi.js';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: number;
  life: number;
  size: number;
}

const COLORS = [0xff4444, 0x44ff44, 0x4488ff, 0xffff44, 0xff44ff, 0x44ffff];

export function CelebrationParticles() {
  const graphicsRef = useRef<PIXI.Graphics | null>(null);
  const particles = useRef<Particle[]>([]);
  const initialized = useRef(false);

  if (!initialized.current) {
    initialized.current = true;
    for (let i = 0; i < 40; i++) {
      particles.current.push({
        x: 0,
        y: -10,
        vx: (Math.random() - 0.5) * 4,
        vy: -Math.random() * 3 - 1,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        life: 1.0,
        size: 1 + Math.random() * 2,
      });
    }
  }

  useTick(
    useCallback((ticker: { deltaTime: number }) => {
      const dt = ticker.deltaTime;
      const g = graphicsRef.current;
      if (!g) return;
      g.clear();

      for (const p of particles.current) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 0.08 * dt; // gravity
        p.life -= 0.015 * dt;

        if (p.life > 0) {
          g.rect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
            .fill({ color: p.color, alpha: p.life });
        }
      }
    }, []),
  );

  const draw = useCallback((g: PIXI.Graphics) => {
    graphicsRef.current = g;
  }, []);

  return <pixiGraphics draw={draw} />;
}
