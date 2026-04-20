'use client';

/**
 * TileMapRenderer — dual-mode background for a Pixi scene.
 *
 *   Mode 1: tile-sliced tilemap. Driven by `map.tileSetUrl` + grid tile
 *           indices in `bgTiles` / `objectTiles`.
 *   Mode 2: static background image. Driven by `map.backgroundImage`;
 *           a single PNG is rendered at (0, 0) sized to match.
 *
 * Animated sprites overlay either mode.
 */

import { useState, useEffect } from 'react';
import { Assets, Texture, Spritesheet, Rectangle } from 'pixi.js';
import type { SpritesheetData } from 'pixi.js';
import type { WorldMap, AnimatedSprite as AnimatedSpriteData } from '../../lib/worldMap';

// Map animation JSON imports
import campfire from '../../data/animations/campfire.json';
import gentlesparkle from '../../data/animations/gentlesparkle.json';
import gentlewaterfall from '../../data/animations/gentlewaterfall.json';
import gentlesplash from '../../data/animations/gentlesplash.json';
import windmill from '../../data/animations/windmill.json';

const ANIMATION_SHEETS: Record<string, { spritesheet: unknown; url: string }> = {
  'campfire.json': { spritesheet: campfire, url: '/assets/spritesheets/campfire.png' },
  'gentlesparkle.json': { spritesheet: gentlesparkle, url: '/assets/spritesheets/gentlesparkle32.png' },
  'gentlewaterfall.json': { spritesheet: gentlewaterfall, url: '/assets/spritesheets/gentlewaterfall32.png' },
  'windmill.json': { spritesheet: windmill, url: '/assets/spritesheets/windmill.png' },
  'gentlesplash.json': { spritesheet: gentlesplash, url: '/assets/spritesheets/gentlewaterfall32.png' },
};

interface TileData {
  texture: Texture;
  x: number;
  y: number;
}

interface BackgroundData {
  texture: Texture;
  width: number;
  height: number;
}

interface AnimSpriteData {
  textures: Texture[];
  x: number;
  y: number;
  w: number;
  h: number;
}

export function TileMapRenderer({ map }: { map: WorldMap }) {
  const [tiles, setTiles] = useState<TileData[]>([]);
  const [background, setBackground] = useState<BackgroundData | null>(null);
  const [animSprites, setAnimSprites] = useState<AnimSpriteData[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      // ── Mode 2: static background image ──────────────────────────
      if (map.backgroundImage) {
        const { url, width, height } = map.backgroundImage;
        const texture = await Assets.load(url);
        if (cancelled) return;
        texture.source.scaleMode = 'nearest';
        setBackground({ texture, width, height });
        setTiles([]);
      }
      // ── Mode 1: tile-sliced tilemap ──────────────────────────────
      else if (map.tileSetUrl && map.bgTiles && map.objectTiles) {
        const baseTexture = await Assets.load(map.tileSetUrl);
        if (cancelled) return;
        baseTexture.source.scaleMode = 'nearest';

        const numXTiles = Math.floor((map.tileSetDimX ?? 0) / map.tileDim);
        const numYTiles = Math.floor((map.tileSetDimY ?? 0) / map.tileDim);

        const tileTextures: Texture[] = [];
        for (let x = 0; x < numXTiles; x++) {
          for (let y = 0; y < numYTiles; y++) {
            tileTextures[x + y * numXTiles] = new Texture({
              source: baseTexture.source,
              frame: new Rectangle(x * map.tileDim, y * map.tileDim, map.tileDim, map.tileDim),
            });
          }
        }

        const screenXTiles = map.bgTiles[0].length;
        const screenYTiles = map.bgTiles[0][0].length;
        const allLayers = [...map.bgTiles, ...map.objectTiles];
        const result: TileData[] = [];

        for (let i = 0; i < screenXTiles * screenYTiles; i++) {
          const x = i % screenXTiles;
          const y = Math.floor(i / screenXTiles);
          for (const layer of allLayers) {
            const tileIndex = layer[x][y];
            if (tileIndex === -1) continue;
            if (tileIndex < 0 || tileIndex >= tileTextures.length) continue;
            result.push({
              texture: tileTextures[tileIndex],
              x: x * map.tileDim,
              y: y * map.tileDim,
            });
          }
        }

        if (cancelled) return;
        setTiles(result);
        setBackground(null);
      }

      // ── Animated sprite overlay (shared by both modes) ───────────
      const spritesBySheet = new Map<string, AnimatedSpriteData[]>();
      for (const sprite of map.animatedSprites) {
        if (!spritesBySheet.has(sprite.sheet)) {
          spritesBySheet.set(sprite.sheet, []);
        }
        spritesBySheet.get(sprite.sheet)!.push(sprite);
      }

      const animResult: AnimSpriteData[] = [];
      for (const [sheet, sprites] of spritesBySheet.entries()) {
        const animation = ANIMATION_SHEETS[sheet];
        if (!animation) continue;
        const texture = await Assets.load(animation.url);
        if (cancelled) return;
        texture.source.scaleMode = 'nearest';
        const spritesheet = new Spritesheet(texture, animation.spritesheet as SpritesheetData);
        await spritesheet.parse();
        if (cancelled) return;

        for (const sprite of sprites) {
          const frames = spritesheet.animations[sprite.animation];
          if (!frames) continue;
          animResult.push({
            textures: frames,
            x: sprite.x,
            y: sprite.y,
            w: sprite.w,
            h: sprite.h,
          });
        }
      }

      if (!cancelled) setAnimSprites(animResult);
    };

    load();
    return () => { cancelled = true; };
  }, [map]);

  return (
    <pixiContainer>
      {background && (
        <pixiSprite
          texture={background.texture}
          x={0}
          y={0}
          width={background.width}
          height={background.height}
        />
      )}
      {tiles.map((t, i) => (
        <pixiSprite key={i} texture={t.texture} x={t.x} y={t.y} />
      ))}
      {animSprites.map((a, i) => (
        <pixiAnimatedSprite
          key={`anim-${i}`}
          textures={a.textures}
          autoPlay
          animationSpeed={0.1}
          x={a.x}
          y={a.y}
          width={a.w}
          height={a.h}
        />
      ))}
    </pixiContainer>
  );
}
