'use client';

/**
 * AmbientParticles — floating dust motes (warm) or data sparks (cool).
 * Drawn via pixiGraphics with useTick for smooth per-frame animation.
 */

import { useRef, useCallback } from 'react';
import { useTick } from '@pixi/react';
import type * as PIXI from 'pixi.js';

interface Mote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  dir: number;
  size: number;
}

interface AmbientParticlesProps {
  worldW: number;
  worldH: number;
  variant: 'warm' | 'cool';
}

export function AmbientParticles({ worldW, worldH, variant }: AmbientParticlesProps) {
  const motes = useRef<Mote[]>([]);
  const graphicsRef = useRef<PIXI.Graphics | null>(null);
  const initialized = useRef(false);

  if (!initialized.current) {
    initialized.current = true;
    for (let i = 0; i < 20; i++) {
      motes.current.push({
        x: Math.random() * worldW,
        y: Math.random() * worldH,
        vx: (Math.random() - 0.5) * 0.15,
        vy: variant === 'warm' ? -Math.random() * 0.1 - 0.02 : Math.random() * 0.2 - 0.1,
        alpha: Math.random() * 0.4,
        dir: Math.random() > 0.5 ? 1 : -1,
        size: variant === 'warm' ? 1 + Math.random() * 1.5 : 1 + Math.random(),
      });
    }
  }

  const color = variant === 'warm' ? 0xeeddaa : 0x6699ff;

  useTick(
    useCallback(() => {
      const g = graphicsRef.current;
      if (!g) return;
      g.clear();
      for (const m of motes.current) {
        m.x += m.vx;
        m.y += m.vy;
        m.alpha += m.dir * 0.004;
        if (m.alpha >= 0.45) { m.alpha = 0.45; m.dir = -1; }
        if (m.alpha <= 0.05) { m.alpha = 0.05; m.dir = 1; }
        if (m.x < 0) m.x = worldW;
        if (m.x > worldW) m.x = 0;
        if (m.y < 0) m.y = worldH;
        if (m.y > worldH) m.y = 0;

        if (variant === 'cool') {
          g.rect(m.x - m.size * 0.5, m.y, m.size, m.size).fill({ color, alpha: m.alpha });
        } else {
          g.circle(m.x, m.y, m.size).fill({ color, alpha: m.alpha });
        }
      }
    }, [worldW, worldH, variant, color]),
  );

  const captureRef = useCallback((g: PIXI.Graphics) => {
    graphicsRef.current = g;
  }, []);

  return <pixiGraphics draw={captureRef} />;
}
