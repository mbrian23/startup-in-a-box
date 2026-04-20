/**
 * Factory screen chrome — renders only the factory-specific overlays
 * (idle state + deployment card) directly over the agent-flow visualizer.
 *
 * The HudShell frame used to wrap this screen, but agent-flow brings its
 * own top bar and control strip; layering the shell's vignette, scanlines,
 * and top-right status cluster over that UI tinted the colors and made
 * icons collide. Agent-flow is self-framed, so we let it fill the slot.
 */

import {
  readDeploymentUrl,
  readGithubUrl,
} from '../hooks/useAgUiEvents';
import type { AgUiState } from '../hooks/useAgUiEvents';

interface FactoryScreenProps {
  state: AgUiState;
}

export function FactoryScreen({ state }: FactoryScreenProps) {
  const deploymentUrl = readDeploymentUrl(state.boardState);
  const githubUrl = readGithubUrl(state.boardState);

  const bs = state.boardState;
  const hasStarted = Boolean(
    bs.current_step || bs.progress || bs.files || deploymentUrl,
  );

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', pointerEvents: 'none' }}>
      {!hasStarted && <NotStartedOverlay />}

      {deploymentUrl && (
          <div
            data-testid="deployment-card"
            className="glass-panel"
            style={{
              position: 'absolute',
              bottom: '20px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(8, 8, 18, 0.9)',
              border: '1px solid rgba(96, 144, 238, 0.15)',
              borderRadius: '14px',
              padding: '14px 24px',
              zIndex: 30,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.02)',
              animation: 'slide-in-bottom 0.4s ease-out',
              pointerEvents: 'auto',
            }}
          >
            <span
              style={{
                fontSize: '0.72rem',
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 700,
                color: '#50c878',
                textTransform: 'uppercase',
                letterSpacing: '0.14em',
                padding: '2px 8px',
                background: 'rgba(80, 200, 120, 0.06)',
                border: '1px solid rgba(80, 200, 120, 0.12)',
                borderRadius: '4px',
              }}
            >
              Deployed
            </span>
            <a
              href={deploymentUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: '0.85rem',
                color: '#80bbff',
                fontFamily: "'JetBrains Mono', monospace",
                textDecoration: 'none',
                borderBottom: '1px solid rgba(128, 187, 255, 0.3)',
                paddingBottom: '1px',
                transition: 'color 0.2s',
              }}
            >
              {deploymentUrl}
            </a>
            {githubUrl && (
              <a
                href={githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: '0.75rem',
                  color: '#706860',
                  fontFamily: "'JetBrains Mono', monospace",
                  textDecoration: 'none',
                  borderBottom: '1px solid rgba(112, 104, 96, 0.2)',
                  paddingBottom: '1px',
                  transition: 'color 0.2s',
                }}
              >
                GitHub: {githubUrl}
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function NotStartedOverlay() {
  return (
    <div
      data-testid="factory-not-started"
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        zIndex: 20,
      }}
    >
      <div
        className="glass-panel"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '14px',
          padding: '28px 40px',
          background: 'rgba(8, 8, 18, 0.75)',
          border: '1px solid rgba(96, 144, 238, 0.12)',
          borderRadius: '14px',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.02)',
          animation: 'fade-up 0.4s ease-out',
        }}
      >
        <span
          style={{
            display: 'inline-block',
            width: '9px',
            height: '9px',
            borderRadius: '50%',
            background: '#6090ee',
            opacity: 0.6,
            boxShadow: '0 0 10px rgba(96, 144, 238, 0.4)',
            animation: 'pulse-dot 2.5s ease-in-out infinite',
          }}
        />
        <span
          style={{
            fontSize: '1rem',
            fontFamily: "'JetBrains Mono', monospace",
            color: '#80bbff',
            textTransform: 'uppercase',
            letterSpacing: '0.18em',
          }}
        >
          Factory Idle
        </span>
        <span
          style={{
            fontSize: '0.8rem',
            fontFamily: "'JetBrains Mono', monospace",
            color: '#70809a',
            letterSpacing: '0.08em',
            textAlign: 'center',
            maxWidth: '320px',
            lineHeight: 1.5,
          }}
        >
          Awaiting build orders from the boardroom. Describe a startup idea to
          begin the pipeline.
        </span>
      </div>
    </div>
  );
}
