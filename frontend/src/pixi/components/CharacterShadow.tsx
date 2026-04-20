'use client';

import { useCallback } from 'react';
import type * as PIXI from 'pixi.js';

/** Drop shadow drawn under the sprite's feet.
 *  `scale` matches the sprite scale so the shadow tracks the feet when
 *  the scene uses larger tiles (48 boardroom, 32 factory). */
export function CharacterShadow({ scale = 1 }: { scale?: number }) {
  const draw = useCallback((g: PIXI.Graphics) => {
    g.clear();
    g.ellipse(0, 12 * scale, 10 * scale, 4 * scale).fill({ color: 0x000000, alpha: 0.2 });
  }, [scale]);

  return <pixiGraphics draw={draw} />;
}
