/**
 * HUD shell — wraps the PixiJS canvas with refined glassmorphism bars,
 * vignette, scanlines, and elegant corner accents.
 *
 * The AppHeader + ArtifactRail + ExecutionTimeline already cover title,
 * status, and run metadata at the app level, so HudShell is now just a
 * frame of atmospheric overlays (vignette / scanlines / optional grid)
 * around the canvas area — no duplicate top/bottom bars eating vertical
 * space.
 */

import type { ReactNode } from 'react';
import { useDebugMode } from '../pixi/debug/debug-mode';

type Variant = 'warm' | 'cool';

const VARIANTS = {
  warm: { vignette: 'vignette-warm' },
  cool: { vignette: 'vignette-cool' },
} as const;

interface HudShellProps {
  variant: Variant;
  showGrid?: boolean;
  children: ReactNode;
}

export function HudShell({ variant, showGrid = false, children }: HudShellProps) {
  const v = VARIANTS[variant];
  // In grid debug mode, drop the atmospheric overlays so the scene
  // reads as an untinted, un-scanlined reference. Makes the debug
  // overlay's red/green tints readable without competing darkening.
  const debugMode = useDebugMode();

  return (
    <div className="relative w-full h-full overflow-hidden">
      {children}

      {!debugMode && (
        <div className={`absolute inset-0 pointer-events-none z-[4] ${v.vignette}`} />
      )}

      {showGrid && (
        <div className="absolute inset-0 pointer-events-none z-[5] grid-overlay opacity-20" />
      )}

      {!debugMode && (
        <div className="absolute inset-0 pointer-events-none z-[6] scanlines" />
      )}
    </div>
  );
}
