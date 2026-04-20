import { useState, useEffect, useRef } from 'react';
import { Assets, Spritesheet } from 'pixi.js';
import type { SpritesheetData } from '../../data/spritesheets/types';

/**
 * Parses a spritesheet from a texture URL and frame data.
 * Prefixes frame names with a unique ID to avoid global texture cache collisions.
 */
export function useSpritesheet(
  textureUrl: string,
  spritesheetData: SpritesheetData,
): Spritesheet | null {
  const [sheet, setSheet] = useState<Spritesheet | null>(null);
  const prefixRef = useRef(`ss-${Math.random().toString(36).slice(2, 8)}`);

  useEffect(() => {
    let cancelled = false;

    const parse = async () => {
      const texture = await Assets.load(textureUrl);
      if (cancelled) return;
      texture.source.scaleMode = 'nearest';

      const prefix = prefixRef.current;
      const prefixedFrames: Record<string, any> = {};
      const prefixedAnimations: Record<string, string[]> = {};

      for (const [name, frame] of Object.entries(spritesheetData.frames)) {
        prefixedFrames[`${prefix}_${name}`] = frame;
      }
      for (const [name, frameNames] of Object.entries(spritesheetData.animations ?? {})) {
        prefixedAnimations[name] = (frameNames as string[]).map((f) => `${prefix}_${f}`);
      }

      const prefixedData: SpritesheetData = {
        ...spritesheetData,
        frames: prefixedFrames,
        animations: prefixedAnimations,
      };

      const spritesheet = new Spritesheet(texture, prefixedData as any);
      await spritesheet.parse();
      if (!cancelled) setSheet(spritesheet);
    };

    parse();
    return () => { cancelled = true; };
  }, [textureUrl, spritesheetData]);

  return sheet;
}
