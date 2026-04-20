'use client';

/**
 * ToolIndicator — animated icon showing which tool the character is using.
 * Uses a pulsing graphics circle + text label instead of tiny emoji.
 */

import { useRef, useCallback } from 'react';
import { useTick } from '@pixi/react';
import type * as PIXI from 'pixi.js';
import { TOOL_SHORT_LABELS } from '../../data/tool-names';

export function ToolIndicator({ toolName }: { toolName: string }) {
  const graphicsRef = useRef<PIXI.Graphics | null>(null);
  const phase = useRef(0);
  const label = TOOL_SHORT_LABELS[toolName] ?? 'TOOL';

  useTick(
    useCallback((ticker: { deltaTime: number }) => {
      const g = graphicsRef.current;
      if (!g) return;
      g.clear();
      phase.current += ticker.deltaTime * 0.06;
      const pulse = 0.5 + Math.sin(phase.current) * 0.3;

      // Pulsing ring around tool indicator
      g.circle(16, -8, 10).fill({ color: 0x44aaff, alpha: pulse * 0.3 });
      g.circle(16, -8, 7).fill({ color: 0x2266aa, alpha: 0.8 });
      g.circle(16, -8, 7).stroke({ color: 0x44aaff, width: 1.5, alpha: pulse });
    }, []),
  );

  const draw = useCallback((g: PIXI.Graphics) => {
    graphicsRef.current = g;
  }, []);

  return (
    <pixiContainer>
      <pixiGraphics draw={draw} />
      <pixiText
        text={label}
        x={16}
        y={-8}
        anchor={{ x: 0.5, y: 0.5 }}
        style={{ fontSize: 6, fill: '#ffffff', fontFamily: 'monospace', fontWeight: 'bold' }}
      />
    </pixiContainer>
  );
}
