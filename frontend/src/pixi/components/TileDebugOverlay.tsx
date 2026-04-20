'use client';

/**
 * TileDebugOverlay — boardroom station + collision inspector.
 *
 * Toggle with the `G` key. While active the overlay lets the author
 * adjust THREE things and see the change live:
 *
 *   1. **Position** — click a yellow dot to select a character (turns
 *      magenta), then click any walkable tile to relocate them.
 *   2. **Rotation** — with a character selected, press ↑ ↓ ← → to set
 *      which way they face at idle. A small blue triangle on the dot
 *      shows the current facing.
 *   3. **Walkability** — with NO character selected, click a tile to
 *      toggle its blocked state. Newly blocked tiles show solid red;
 *      newly un-blocked tiles show a green checkerboard hatching.
 *
 * Everything funnels through `position-overrides`; pathfinding reads
 * the effective blocked set from there, so handoffs and movement
 * respect the live edits. OverridesPanel (HTML) exports everything
 * the author has changed as a copy-pasteable snippet, and a Commit
 * button persists it back to the canonical JSON on disk.
 */

import { useCallback, useEffect, useMemo, useRef, useState, Fragment } from 'react';
import { useTick } from '@pixi/react';
import { Circle, Rectangle } from 'pixi.js';
import type * as PIXI from 'pixi.js';
import type { WorldMap } from '../../lib/worldMap';
import { ALL_CHARACTERS } from '../../data/startup-characters';
import {
  effectiveBlocked,
  getOverride,
  getPaintMode,
  getRotationOverride,
  setOverride,
  setRotationOverride,
  setTileBlocked,
  toggleBlockedTile,
  useOverridesVersion,
  type Orientation,
} from '../debug/position-overrides';

const TILESET_COLS = 16;

function regionColor(tileIdx: number): number {
  const col = tileIdx % TILESET_COLS;
  const row = Math.floor(tileIdx / TILESET_COLS);
  const bx = Math.floor(col / 4);
  const by = Math.floor(row / 4);
  const hue = ((bx * 7 + by * 13) * 37) % 360;
  const h = hue / 60;
  const c = 0.6;
  const x = c * (1 - Math.abs(h % 2 - 1));
  let r = 0, g = 0, b = 0;
  if (h < 1) { r = c; g = x; }
  else if (h < 2) { r = x; g = c; }
  else if (h < 3) { g = c; b = x; }
  else if (h < 4) { g = x; b = c; }
  else if (h < 5) { r = x; b = c; }
  else { r = c; b = x; }
  return (
    (Math.floor((r + 0.3) * 255) << 16) |
    (Math.floor((g + 0.3) * 255) << 8) |
    Math.floor((b + 0.3) * 255)
  );
}

const ARROW_KEY_TO_DIR: Record<string, Orientation> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

export function TileDebugOverlay({ map }: { map: WorldMap }) {
  const graphicsRef = useRef<PIXI.Graphics | null>(null);
  const prevVersion = useRef(-1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const overrideVersion = useOverridesVersion();

  // Arrow keys while a character is selected → rotation override.
  useEffect(() => {
    if (!selectedId) return;
    const onKey = (ev: KeyboardEvent) => {
      const dir = ARROW_KEY_TO_DIR[ev.key];
      if (!dir) return;
      const target = ev.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      setRotationOverride(selectedId, dir);
      ev.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId]);

  const effectiveBlockedSet = effectiveBlocked(map.blockedTiles);

  useTick(
    useCallback(() => {
      const g = graphicsRef.current;
      if (!g) return;
      if (prevVersion.current === overrideVersion && prevVersion.current !== -1) return;
      prevVersion.current = overrideVersion;

      g.clear();
      const dim = map.tileDim;

      // Grid lines (both modes).
      for (let x = 0; x <= map.width; x++) {
        g.moveTo(x * dim, 0).lineTo(x * dim, map.height * dim)
          .stroke({ color: 0xffffff, alpha: 0.1, width: 1 });
      }
      for (let y = 0; y <= map.height; y++) {
        g.moveTo(0, y * dim).lineTo(map.width * dim, y * dim)
          .stroke({ color: 0xffffff, alpha: 0.1, width: 1 });
      }

      if (map.blockedTiles) {
        for (let x = 0; x < map.width; x++) {
          for (let y = 0; y < map.height; y++) {
            const key = `${x},${y}`;
            const sourceBlocked = map.blockedTiles.has(key);
            const effBlocked = effectiveBlockedSet.has(key);
            const toggled = sourceBlocked !== effBlocked;
            if (effBlocked) {
              g.rect(x * dim + 1, y * dim + 1, dim - 2, dim - 2)
                .fill({ color: 0xff3355, alpha: toggled ? 0.55 : 0.32 });
              if (toggled) {
                // Diagonal hatch accent so toggled tiles stand out
                // against the source blocked ones.
                g.moveTo(x * dim + 2, y * dim + 2)
                  .lineTo(x * dim + dim - 2, y * dim + dim - 2)
                  .stroke({ color: 0xffffff, alpha: 0.6, width: 1 });
              }
            } else {
              g.rect(x * dim + 1, y * dim + 1, dim - 2, dim - 2)
                .stroke({ color: 0x33ff88, alpha: toggled ? 0.9 : 0.35, width: toggled ? 2 : 1 });
              if (toggled) {
                g.moveTo(x * dim + 2, y * dim + 2)
                  .lineTo(x * dim + dim - 2, y * dim + dim - 2)
                  .stroke({ color: 0x33ff88, alpha: 0.85, width: 2 });
              }
            }
          }
        }
      } else if (map.objectTiles) {
        for (const layer of map.objectTiles) {
          for (let x = 0; x < layer.length; x++) {
            for (let y = 0; y < layer[x].length; y++) {
              const idx = layer[x][y];
              if (idx === -1) continue;
              const color = regionColor(idx);
              g.rect(x * dim + 1, y * dim + 1, dim - 2, dim - 2)
                .fill({ color, alpha: 0.25 });
              g.rect(x * dim + 1, y * dim + 1, dim - 2, dim - 2)
                .stroke({ color, alpha: 0.5, width: 1 });
            }
          }
        }
      }
    }, [map, overrideVersion, effectiveBlockedSet]),
  );

  const captureRef = useCallback((g: PIXI.Graphics) => {
    graphicsRef.current = g;
    prevVersion.current = -1;
  }, []);

  // Full-world click target. Two modes:
  //   - character selected  → click moves that character to the tile.
  //   - no selection        → click toggles the tile's blocked state.
  const worldHitArea = useCallback(
    (g: PIXI.Graphics) => {
      g.clear();
      g.rect(0, 0, map.width * map.tileDim, map.height * map.tileDim)
        .fill({ color: 0x000000, alpha: 0.0001 });
    },
    [map.width, map.height, map.tileDim],
  );

  const handleTileClick = useCallback(
    (evt: PIXI.FederatedPointerEvent) => {
      const lp = evt.getLocalPosition(evt.currentTarget as PIXI.Container);
      const tx = Math.floor(lp.x / map.tileDim);
      const ty = Math.floor(lp.y / map.tileDim);
      if (tx < 0 || tx >= map.width || ty < 0 || ty >= map.height) return;
      const key = `${tx},${ty}`;

      if (selectedId) {
        if (effectiveBlockedSet.has(key)) return;
        setOverride(selectedId, { x: tx, y: ty });
        setSelectedId(null);
      } else {
        const mode = getPaintMode();
        if (mode === 'toggle') toggleBlockedTile(key);
        else if (mode === 'block') setTileBlocked(key, true, map.blockedTiles);
        else if (mode === 'free') setTileBlocked(key, false, map.blockedTiles);
      }
      evt.stopPropagation();
    },
    [selectedId, map.tileDim, map.width, map.height, map.blockedTiles, effectiveBlockedSet],
  );

  const paintMode = getPaintMode();
  const worldCursor = selectedId
    ? 'crosshair'
    : paintMode === 'block'
      ? 'not-allowed'
      : paintMode === 'free'
        ? 'copy'
        : paintMode === 'toggle'
          ? 'cell'
          : 'default';

  const drawDot = useCallback(
    (g: PIXI.Graphics, isSelected: boolean, facing: Orientation | null) => {
      g.clear();
      const r = Math.max(6, map.tileDim * 0.18);
      g.circle(0, 0, r)
        .fill({ color: isSelected ? 0xff66ff : 0xffe14a, alpha: 0.95 })
        .stroke({ color: 0x000000, alpha: 0.9, width: 2 });
      if (isSelected) {
        g.circle(0, 0, r + 4).stroke({ color: 0xff66ff, alpha: 0.7, width: 2 });
      }
      if (facing) {
        // Small facing arrow on the far side of the dot.
        const arrowR = r + 6;
        const vecs: Record<Orientation, [number, number]> = {
          up: [0, -1],
          down: [0, 1],
          left: [-1, 0],
          right: [1, 0],
        };
        const [vx, vy] = vecs[facing];
        const tipX = vx * arrowR;
        const tipY = vy * arrowR;
        const baseX = vx * (arrowR - 5);
        const baseY = vy * (arrowR - 5);
        // Perpendicular spread for the arrowhead base.
        const px = -vy * 4;
        const py = vx * 4;
        g.poly([
          tipX, tipY,
          baseX + px, baseY + py,
          baseX - px, baseY - py,
        ])
          .fill({ color: 0x66ccff, alpha: 0.95 })
          .stroke({ color: 0x000000, alpha: 0.85, width: 1 });
      }
    },
    [map.tileDim],
  );

  const stationLabels = map.blockedTiles
    ? Array.from(ALL_CHARACTERS.values()).filter((c) => c.screen === 'boardroom')
    : [];

  // Explicit hit shapes so clicks reliably land on Graphics children.
  // Without these Pixi sometimes falls back to empty bounds for a
  // just-drawn Graphics and the pointer events never fire.
  const dotHitArea = useMemo(
    () => new Circle(0, 0, Math.max(10, map.tileDim * 0.26)),
    [map.tileDim],
  );
  const worldHitRect = useMemo(
    () => new Rectangle(0, 0, map.width * map.tileDim, map.height * map.tileDim),
    [map.width, map.height, map.tileDim],
  );

  const paintActive = paintMode !== 'off';

  return (
    <pixiContainer>
      <pixiGraphics draw={captureRef} />

      {/* Paint mode is modal — only the tile hit area is rendered so
          nothing can shadow tile clicks. Rendered AFTER the grid so
          its hit target sits on top. */}
      {paintActive && map.blockedTiles && (
        <pixiGraphics
          draw={worldHitArea}
          eventMode="static"
          cursor={worldCursor}
          hitArea={worldHitRect}
          onPointerDown={handleTileClick}
          onPointerTap={handleTileClick}
        />
      )}

      {/* Move-mode hit area — only when a character is selected. */}
      {!paintActive && selectedId && map.blockedTiles && (
        <pixiGraphics
          draw={worldHitArea}
          eventMode="static"
          cursor="crosshair"
          hitArea={worldHitRect}
          onPointerDown={handleTileClick}
          onPointerTap={handleTileClick}
        />
      )}

      {/* Dots render only when NOT painting so nothing overlaps the
          tile hit target. In paint mode the board is purely a tile
          canvas. */}
      {!paintActive && stationLabels.map((c) => {
        const pos = getOverride(c.id) ?? c.idlePosition;
        const cx = pos.x * map.tileDim + map.tileDim / 2;
        const cy = pos.y * map.tileDim + map.tileDim / 2;
        const isSelected = selectedId === c.id;
        const facing = getRotationOverride(c.id);
        return (
          <Fragment key={c.id}>
            <pixiGraphics
              x={cx}
              y={cy}
              draw={(g) => drawDot(g, isSelected, facing)}
              eventMode="static"
              cursor="pointer"
              hitArea={dotHitArea}
              onPointerDown={(e: PIXI.FederatedPointerEvent) => {
                e.stopPropagation();
                setSelectedId(isSelected ? null : c.id);
              }}
            />
            <pixiText
              x={cx}
              y={cy + Math.max(10, map.tileDim * 0.3)}
              text={c.id}
              anchor={{ x: 0.5, y: 0 }}
              style={{
                fontSize: 10,
                fill: isSelected ? '#ff66ff' : '#ffe14a',
                stroke: { color: '#000000', width: 3 },
                fontFamily: 'monospace',
                fontWeight: 'bold',
              }}
            />
            <pixiText
              x={cx}
              y={cy - Math.max(12, map.tileDim * 0.34)}
              text={`${pos.x},${pos.y}${facing ? ' ' + facing[0].toUpperCase() : ''}`}
              anchor={{ x: 0.5, y: 1 }}
              style={{
                fontSize: 9,
                fill: '#ffffff',
                stroke: { color: '#000000', width: 2.5 },
                fontFamily: 'monospace',
              }}
            />
          </Fragment>
        );
      })}
    </pixiContainer>
  );
}
