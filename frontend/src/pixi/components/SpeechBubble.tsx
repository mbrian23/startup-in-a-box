'use client';

/**
 * SpeechBubble — rounded rect with a name header and typing-effect text.
 *
 * The bubble self-positions so it stays inside the world regardless of
 * where its character stands:
 *   - **horizontal clamp**: if the character is near a side wall, the
 *     bubble's body slides left or right so it doesn't overflow world
 *     bounds. The speech tail stays pointing at the character's head.
 *   - **vertical flip**: if the character is near the top edge, the
 *     bubble flips below them instead of hovering above.
 *
 * Sized generously so a paragraph of dialogue fits without being cut
 * off mid-sentence.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTick } from '@pixi/react';
import type * as PIXI from 'pixi.js';

interface SpeechBubbleProps {
  text: string;
  isStreaming: boolean;
  name?: string;
  /** Character's world pixel x — used to clamp the bubble horizontally. */
  charX?: number;
  /** Character's world pixel y — used to decide whether to flip below. */
  charY?: number;
  /** World width in pixels — bubble right edge never exceeds this. */
  worldW?: number;
  /** World height in pixels — used for top-edge flip decision. */
  worldH?: number;
}

// Bubble geometry. Sized compact so it doesn't dominate the 624×576
// boardroom canvas — ~5 lines of 11px monospace.
const BG_W = 240;
const BG_H = 110;
const HEADER_H = 18;
const PAD_X = 10;
const PAD_Y = 8;
const BUBBLE_GAP = 14;
const HALF_SPRITE = 24;
const SHADOW_EXTEND = 4; // drop shadow extends bottom-right by 4px
const MAX_CHARS = 200;
const TEXT_WRAP = BG_W - PAD_X * 2;

export function SpeechBubble({
  text,
  isStreaming,
  name,
  charX,
  charY,
  worldW,
  worldH,
}: SpeechBubbleProps) {
  const [displayedText, setDisplayedText] = useState('');
  const fullTextRef = useRef('');
  const revealIndex = useRef(0);
  const revealTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const fullText =
      text.length > MAX_CHARS ? text.substring(text.length - MAX_CHARS) : text;

    if (!fullText) {
      setDisplayedText('');
      revealIndex.current = 0;
      fullTextRef.current = '';
      return;
    }

    if (fullText.startsWith(fullTextRef.current)) {
      fullTextRef.current = fullText;
    } else {
      fullTextRef.current = fullText;
      revealIndex.current = 0;
    }
  }, [text]);

  useEffect(() => {
    revealTimer.current = setInterval(() => {
      if (revealIndex.current < fullTextRef.current.length) {
        revealIndex.current = Math.min(revealIndex.current + 2, fullTextRef.current.length);
        setDisplayedText(fullTextRef.current.substring(0, revealIndex.current));
      }
    }, 30);

    return () => {
      if (revealTimer.current) {
        clearInterval(revealTimer.current);
        revealTimer.current = null;
      }
    };
  }, []);

  const showCursor = isStreaming && displayedText.length > 0 && displayedText.length < text.length;

  // ── Position bubble so it stays inside the world ────────────────
  const layout = useMemo(() => {
    const flipBelow =
      charY !== undefined && worldH !== undefined && charY < worldH * 0.35;

    // Default: bubble body hovers above the character's head with its
    // bottom just above the sprite + gap. Flip: body sits below the
    // character's feet with its top below the sprite + gap.
    let bodyTop = -HALF_SPRITE - BUBBLE_GAP - BG_H;
    if (flipBelow) {
      bodyTop = HALF_SPRITE + BUBBLE_GAP;
    }

    // Horizontal clamp includes SHADOW_EXTEND so the drop shadow
    // doesn't poke past the world edge when a character stands near a
    // side wall.
    let bodyLeft = -BG_W / 2;
    if (charX !== undefined && worldW !== undefined) {
      const worldLeftEdge = 4 - charX;
      const worldRightEdge = worldW - 4 - charX - SHADOW_EXTEND;
      if (bodyLeft < worldLeftEdge) bodyLeft = worldLeftEdge;
      if (bodyLeft + BG_W > worldRightEdge) bodyLeft = worldRightEdge - BG_W;
    }

    return { bodyTop, bodyLeft, flipBelow };
  }, [charX, charY, worldW, worldH]);

  const drawBg = useCallback((g: PIXI.Graphics) => {
    g.clear();
    const bx = layout.bodyLeft;
    const by = layout.bodyTop;
    // Drop shadow
    g.roundRect(bx + 4, by + 4, BG_W, BG_H, 10).fill({ color: 0x000000, alpha: 0.55 });
    g.roundRect(bx + 2, by + 2, BG_W, BG_H, 10).fill({ color: 0x000000, alpha: 0.45 });
    // Body
    g.roundRect(bx, by, BG_W, BG_H, 10).fill({ color: 0x0a0f1f, alpha: 0.98 });
    // Name header strip
    if (name) {
      g.roundRect(bx, by, BG_W, HEADER_H, 10).fill({ color: 0x1a3a7a, alpha: 1 });
      g.rect(bx, by + HEADER_H - 4, BG_W, 4).fill({ color: 0x1a3a7a, alpha: 1 });
      g.moveTo(bx + 6, by + HEADER_H)
        .lineTo(bx + BG_W - 6, by + HEADER_H)
        .stroke({ color: 0x88ccff, width: 1, alpha: 0.85 });
    }
    // Borders
    g.roundRect(bx, by, BG_W, BG_H, 10).stroke({ color: 0x000000, width: 2.5, alpha: 0.9 });
    g.roundRect(bx + 1, by + 1, BG_W - 2, BG_H - 2, 9).stroke({ color: 0x88ccff, width: 1.5, alpha: 0.95 });

    // Speech tail — always points at the character regardless of
    // horizontal clamp. Tail sits at x=0 (character center).
    if (layout.flipBelow) {
      const tailY = by;
      g.poly([-7, tailY, 0, tailY - 9, 7, tailY]).fill({ color: 0x0a0f1f, alpha: 0.98 });
      g.poly([-7, tailY, 0, tailY - 9, 7, tailY]).stroke({ color: 0x88ccff, width: 1.5, alpha: 0.9 });
    } else {
      const tailY = by + BG_H;
      g.poly([-7, tailY, 0, tailY + 9, 7, tailY]).fill({ color: 0x0a0f1f, alpha: 0.98 });
      g.poly([-7, tailY, 0, tailY + 9, 7, tailY]).stroke({ color: 0x88ccff, width: 1.5, alpha: 0.9 });
    }
  }, [name, layout]);

  if (!displayedText) {
    return <SpeakingDots />;
  }

  const nameY = layout.bodyTop + HEADER_H / 2;
  const textY = layout.bodyTop + HEADER_H + PAD_Y;

  return (
    <pixiContainer>
      <pixiGraphics draw={drawBg} />
      {name && (
        <pixiText
          x={layout.bodyLeft + BG_W / 2}
          y={nameY}
          text={name}
          anchor={{ x: 0.5, y: 0.5 }}
          style={{
            fontSize: 11,
            fill: '#ffffff',
            stroke: { color: '#000000', width: 2 },
            fontFamily: 'monospace',
            fontWeight: 'bold',
          }}
        />
      )}
      <pixiText
        x={layout.bodyLeft + PAD_X}
        y={textY}
        text={displayedText + (showCursor ? '\u{2588}' : '')}
        anchor={{ x: 0, y: 0 }}
        style={{
          fontSize: 11,
          fill: '#e0e0f0',
          wordWrap: true,
          wordWrapWidth: TEXT_WRAP,
          lineHeight: 14,
          fontFamily: 'monospace',
        }}
      />
    </pixiContainer>
  );
}

/** Animated "..." dots shown while speech text hasn't started revealing yet. */
function SpeakingDots() {
  const graphicsRef = useRef<PIXI.Graphics | null>(null);
  const phase = useRef(0);

  useTick(
    useCallback((ticker: { deltaTime: number }) => {
      const g = graphicsRef.current;
      if (!g) return;
      g.clear();
      phase.current += ticker.deltaTime * 0.08;

      for (let i = 0; i < 3; i++) {
        const dotPhase = phase.current + i * 0.8;
        const bounce = Math.sin(dotPhase) * 3;
        const alpha = 0.4 + Math.sin(dotPhase) * 0.4;
        g.circle(-8 + i * 8, -30 + bounce, 3).fill({ color: 0x88ccff, alpha });
      }
    }, []),
  );

  const draw = useCallback((g: PIXI.Graphics) => {
    graphicsRef.current = g;
  }, []);

  return <pixiGraphics draw={draw} />;
}
