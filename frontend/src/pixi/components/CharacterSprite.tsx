'use client';

/**
 * CharacterSprite — renders a directional animated sprite from a spritesheet.
 * Animates differently based on the current action type.
 */

import { useRef, useEffect, useCallback } from 'react';
import { useTick } from '@pixi/react';
import type * as PIXI from 'pixi.js';
import type { Spritesheet } from 'pixi.js';
import type { ActionType } from '../actions/types';

interface CharacterSpriteProps {
  spritesheet: Spritesheet;
  orientation: 'up' | 'down' | 'left' | 'right';
  actionType: ActionType;
  speed?: number;
  /** Uniform scale applied to the 32px sprite. Scenes using larger
   *  tiles pass `tileDim / 32` so the character occupies its tile. */
  scale?: number;
}

export function CharacterSprite({ spritesheet, orientation, actionType, speed = 0.1, scale = 1 }: CharacterSpriteProps) {
  const ref = useRef<PIXI.AnimatedSprite>(null);
  const timerRef = useRef(0);
  const currentFrameRef = useRef(0);

  // Determine which animation direction to use based on action type
  const animDirection =
    actionType === 'think' || actionType === 'celebrate' ? 'down' : orientation;

  const textures = spritesheet.animations[animDirection];

  // Handle play/stop and animation speed for simple cases (move, use_tool, celebrate)
  useEffect(() => {
    const sprite = ref.current;
    if (!sprite) return;

    if (actionType === 'move') {
      sprite.animationSpeed = speed;
      sprite.play();
    } else if (actionType === 'celebrate') {
      sprite.animationSpeed = 0.2;
      sprite.play();
    } else {
      // For idle, think, speak, use_tool — hold the idle frame. Without
      // this `use_tool` played the walk frames in place, so a stationary
      // character looked like they were walking nowhere.
      sprite.stop();
      sprite.gotoAndStop(0);
    }

    // Reset timer when action or direction changes
    timerRef.current = 0;
    currentFrameRef.current = 0;
  }, [actionType, animDirection, speed]);

  // Manual frame control for think and speak actions
  useTick(
    useCallback(
      (ticker: { deltaTime: number }) => {
        const sprite = ref.current;
        if (!sprite) return;

        if (actionType === 'think') {
          // Slow oscillation between frames 0 and 1
          timerRef.current += ticker.deltaTime * 0.03;
          const frame = Math.floor(timerRef.current) % 2;
          if (frame !== currentFrameRef.current) {
            currentFrameRef.current = frame;
            sprite.gotoAndStop(frame);
          }
        } else if (actionType === 'speak') {
          // Fast alternation between frames 0 and 1
          timerRef.current += ticker.deltaTime * 0.15;
          const frame = Math.floor(timerRef.current) % 2;
          if (frame !== currentFrameRef.current) {
            currentFrameRef.current = frame;
            sprite.gotoAndStop(frame);
          }
        }
      },
      [actionType],
    ),
  );

  if (!textures) return null;

  return (
    <pixiAnimatedSprite
      ref={ref}
      autoPlay={false}
      textures={textures}
      animationSpeed={speed}
      anchor={{ x: 0.5, y: 0.5 }}
      scale={scale}
    />
  );
}
