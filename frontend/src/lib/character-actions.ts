/**
 * Character action types — renderer-agnostic.
 *
 * These describe WHAT a character is doing, not HOW it's rendered.
 * Any renderer (pixi, CSS/DOM, canvas2d) consumes these to decide
 * which visual to show.
 */

export type ActionType = 'idle' | 'move' | 'think' | 'speak' | 'use_tool' | 'celebrate';

export interface IdleAction {
  type: 'idle';
}

export interface MoveAction {
  type: 'move';
  targetX: number;
  targetY: number;
}

export interface ThinkAction {
  type: 'think';
}

export interface SpeakAction {
  type: 'speak';
  text: string;
  isStreaming: boolean;
}

export interface UseToolAction {
  type: 'use_tool';
  toolName: string;
  zoneX: number;
  zoneY: number;
}

export interface CelebrateAction {
  type: 'celebrate';
}

export type CharacterAction =
  | IdleAction
  | MoveAction
  | ThinkAction
  | SpeakAction
  | UseToolAction
  | CelebrateAction;

/**
 * Pure function: derives the current CharacterAction from agent + spatial state.
 * No renderer dependency — trivially unit-testable.
 *
 * Priority order:
 *   1. celebration → CelebrateAction
 *   2. isMoving || targetPosition → MoveAction
 *   3. currentTool → UseToolAction
 *   4. isSpeaking && speechBubble → SpeakAction
 *   5. isThinking → ThinkAction
 *   6. default → IdleAction
 */
export function deriveAction(
  worker: { isMoving: boolean; targetPosition: { x: number; y: number } | null; position: { x: number; y: number }; currentTool: string | null; isSpeaking: boolean; speechBubble: string | null; isThinking: boolean },
  celebration: boolean,
): CharacterAction {
  if (celebration) {
    return { type: 'celebrate' };
  }

  if (worker.isMoving && worker.targetPosition) {
    return {
      type: 'move',
      targetX: worker.targetPosition.x,
      targetY: worker.targetPosition.y,
    };
  }

  if (worker.currentTool) {
    return {
      type: 'use_tool',
      toolName: worker.currentTool,
      zoneX: worker.targetPosition?.x ?? worker.position.x,
      zoneY: worker.targetPosition?.y ?? worker.position.y,
    };
  }

  if (worker.isSpeaking && worker.speechBubble) {
    return {
      type: 'speak',
      text: worker.speechBubble,
      isStreaming: true,
    };
  }

  if (worker.isThinking) {
    return { type: 'think' };
  }

  return { type: 'idle' };
}
