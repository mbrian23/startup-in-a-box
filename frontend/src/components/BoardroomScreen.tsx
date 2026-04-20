/**
 * Boardroom screen — HTML chrome (HudShell + overlays) for the orchestrator.
 *
 * Pixi content is rendered by the shared <SharedPixiShell> owned by <App>,
 * which keeps the Pixi Application alive across screen swaps. This component
 * now only renders HudShell framing and the HTML-side handoff overlays
 * (factory progress readout + the error card when a handoff fails).
 */

import { HudShell } from './HudShell';
import { OverridesPanel } from './OverridesPanel';
import { readHandoffStage, readFactoryProgress } from '../hooks/useAgUiEvents';
import type { AgUiState } from '../hooks/useAgUiEvents';
import { useHandoffAnimation } from '../hooks/useHandoffAnimation';
import { useDebugHotkey, useDebugMode } from '../pixi/debug/debug-mode';

interface BoardroomScreenProps {
  state: AgUiState;
}

export function BoardroomScreen({ state }: BoardroomScreenProps) {
  // Single G-key listener for the whole screen. Both SceneRenderer
  // (Pixi overlay) and OverridesPanel (HTML) read from the same
  // shared store so they toggle together.
  useDebugHotkey();
  const debugMode = useDebugMode();

  const handoffStage = readHandoffStage(state.boardState);
  const factoryProgress = readFactoryProgress(state.boardState);
  const animation = useHandoffAnimation(handoffStage, 'dark');

  return (
    <HudShell variant="warm">
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          // Let clicks fall through to the Pixi canvas below; only
          // descendants that explicitly set pointerEvents: 'auto'
          // (e.g. OverridesPanel) capture.
          pointerEvents: 'none',
        }}
      >
        {/* Legacy pneumatic-tube overlay removed — the retro-office scene
            doesn't have a physical tube. Handoff animation now lives
            entirely in the Pixi layer (character turn + speech bubble). */}

        {/* Factory progress */}
        {factoryProgress > 0 && factoryProgress < 1 && (
          <div
            data-testid="factory-progress"
            className="glass-panel-subtle"
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              padding: '6px 14px',
              background: 'rgba(8, 8, 16, 0.8)',
              color: '#80bbff',
              fontSize: '0.85rem',
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 600,
              borderRadius: '8px',
              border: '1px solid rgba(96, 144, 238, 0.1)',
              pointerEvents: 'none',
              letterSpacing: '0.04em',
            }}
          >
            Factory: {Math.round(factoryProgress * 100)}%
          </div>
        )}

        {/* Overrides panel — only visible while grid debug mode is
            active (press G to toggle). Shows position/rotation/blocked
            overrides and lets you commit them to the canonical JSON. */}
        {debugMode && <OverridesPanel />}

        {/* Error card */}
        {animation.errorActive && (
          <div
            data-testid="error-card"
            className="glass-panel"
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              padding: '20px 28px',
              background: 'rgba(232, 60, 60, 0.9)',
              color: '#fff',
              borderRadius: '12px',
              fontSize: '1rem',
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 600,
              boxShadow: '0 12px 40px rgba(232, 60, 60, 0.25)',
              pointerEvents: 'none',
              animation: 'fade-up 0.3s ease-out',
            }}
          >
            Handoff failed — operator reset required
          </div>
        )}
      </div>
    </HudShell>
  );
}
