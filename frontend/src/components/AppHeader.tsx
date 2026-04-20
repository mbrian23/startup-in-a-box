/**
 * Top header bar — branding, global status cluster, screen tabs.
 */

import { ScreenTabs } from './ScreenTabs';
import { AppStatusCluster } from './AppStatusCluster';
import { ThemePicker } from './ThemePicker';
import type { ActiveScreen } from '../hooks/useAutoFocus';
import type { AgentActivity } from '../hooks/useAgentActivity';
import { useSessionReset } from '../lib/session-reset';


interface AppHeaderProps {
  active: ActiveScreen;
  onSwitch: (screen: ActiveScreen) => void;
  activity: AgentActivity;
  deploymentUrl: string | null;
  githubUrl: string | null;
  costUsd: number | null;
  hideReset?: boolean;
  onReset?: () => void;
}

export function AppHeader({ active, onSwitch, activity, deploymentUrl, githubUrl, costUsd, hideReset, onReset }: AppHeaderProps) {
  const { reset: sessionReset } = useSessionReset();
  const reset = onReset ?? sessionReset;

  return (
    <header className="relative flex items-center justify-between gap-4 px-6 py-4 shrink-0">
      {/* Gradient underline */}
      <div
        className="absolute bottom-0 left-6 right-6 h-px"
        style={{
          background:
            'linear-gradient(to right, var(--color-warm-accent-dim), var(--color-cool-accent-dim), transparent)',
        }}
      />

      <div className="flex items-center gap-3 shrink-0">
        <h1
          className="font-display-warm text-[2.25rem] text-gold"
          style={{ letterSpacing: '0.02em' }}
        >
          Startup in a Box
        </h1>
        <ThemePicker />
      </div>

      <div className="flex-1 flex items-center justify-center min-w-0">
        <AppStatusCluster
          activity={activity}
          deploymentUrl={deploymentUrl}
          githubUrl={githubUrl}
          costUsd={costUsd}
        />
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {!hideReset && (
          <button
            type="button"
            onClick={reset}
            className="text-[0.75rem] uppercase tracking-[0.15em] text-gold px-3 py-1 rounded transition-colors"
            style={{
              border: '1px solid rgb(var(--color-warm-accent-rgb) / 0.35)',
              background: 'rgb(var(--color-warm-accent-rgb) / 0.06)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgb(var(--color-warm-accent-rgb) / 0.14)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgb(var(--color-warm-accent-rgb) / 0.06)';
            }}
          >
            New Unicorn
          </button>
        )}
        <ScreenTabs active={active} onSwitch={onSwitch} />
      </div>
    </header>
  );
}
