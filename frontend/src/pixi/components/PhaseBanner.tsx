'use client';

/**
 * PhaseBanner — centered text overlay that fades in/out during agent transitions.
 * Shows messages like "Strategy Complete → Research Phase" between agent handoffs.
 */

import { useRef, useState, useEffect, useCallback } from 'react';
import { useTick } from '@pixi/react';
import type * as PIXI from 'pixi.js';

interface PhaseBannerProps {
  text: string | null;
  worldW: number;
  worldH: number;
}

export function PhaseBanner({ text, worldW, worldH }: PhaseBannerProps) {
  const [displayText, setDisplayText] = useState<string | null>(null);
  const graphicsRef = useRef<PIXI.Graphics | null>(null);
  const textRef = useRef<PIXI.Text | null>(null);
  const alpha = useRef(0);
  const phase = useRef<'in' | 'hold' | 'out' | 'idle'>('idle');
  const timer = useRef(0);

  // React forbids ref mutation during render and state writes in
  // plain render bodies, but the animation state machine needs both
  // (alpha/phase/timer are read at 60fps from useTick). The effect
  // below is therefore genuinely required — we're syncing an animation
  // pipeline, not just deriving a value.
  useEffect(() => {
    if (text) {
      setDisplayText(text);
      alpha.current = 0;
      phase.current = 'in';
      timer.current = 0;
    }
  }, [text]);

  useTick(
    useCallback(
      (ticker: { deltaTime: number }) => {
        if (phase.current === 'idle') return;
        const dt = ticker.deltaTime;

        switch (phase.current) {
          case 'in':
            alpha.current = Math.min(alpha.current + dt * 0.04, 1);
            if (alpha.current >= 1) {
              phase.current = 'hold';
              timer.current = 0;
            }
            break;
          case 'hold':
            timer.current += dt;
            if (timer.current > 180) { // ~3 seconds at 60fps
              phase.current = 'out';
            }
            break;
          case 'out':
            alpha.current = Math.max(alpha.current - dt * 0.03, 0);
            if (alpha.current <= 0) {
              phase.current = 'idle';
              setDisplayText(null);
            }
            break;
        }

        // Update visuals
        const g = graphicsRef.current;
        if (g) {
          g.clear();
          g.rect(0, worldH / 2 - 24, worldW, 48)
            .fill({ color: 0x000000, alpha: alpha.current * 0.6 });
        }
        const t = textRef.current;
        if (t) {
          t.alpha = alpha.current;
        }
      },
      [worldW, worldH],
    ),
  );

  const drawBg = useCallback((g: PIXI.Graphics) => {
    graphicsRef.current = g;
  }, []);

  if (!displayText) return null;

  return (
    <pixiContainer>
      <pixiGraphics draw={drawBg} />
      <pixiText
        ref={(ref: PIXI.Text | null) => { textRef.current = ref; }}
        text={displayText}
        x={worldW / 2}
        y={worldH / 2}
        anchor={{ x: 0.5, y: 0.5 }}
        alpha={0}
        style={{
          fontSize: 18,
          fill: '#d4a24e',
          fontFamily: 'monospace',
          fontWeight: 'bold',
          letterSpacing: 2,
          dropShadow: {
            color: 0x000000,
            blur: 4,
            distance: 2,
            alpha: 0.8,
          },
        }}
      />
    </pixiContainer>
  );
}
