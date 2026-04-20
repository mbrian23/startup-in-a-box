/**
 * Minimal tab switcher — two pills at the top to swap between rooms.
 * Active tab gets accent color + glow; inactive is muted.
 */

import type { ActiveScreen } from '../hooks/useAutoFocus';

interface ScreenTabsProps {
  active: ActiveScreen;
  onSwitch: (screen: ActiveScreen) => void;
}

const TABS: { id: ActiveScreen; label: string; accent: string; glow: string; border: string }[] = [
  {
    id: 'boardroom',
    label: 'Boardroom',
    accent: 'var(--color-warm-accent)',
    glow: 'rgb(var(--color-warm-accent-rgb) / 0.15)',
    border: 'rgb(var(--color-warm-accent-rgb) / 0.25)',
  },
  {
    id: 'factory',
    label: 'Factory',
    accent: 'var(--color-cool-accent)',
    glow: 'rgba(96, 144, 238, 0.15)',
    border: 'rgba(96, 144, 238, 0.25)',
  },
];

export function ScreenTabs({ active, onSwitch }: ScreenTabsProps) {
  return (
    <div className="flex items-center gap-1">
      {TABS.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onSwitch(tab.id)}
            className="relative px-4 py-1.5 rounded-lg text-[0.75rem] font-semibold uppercase tracking-[0.1em] cursor-pointer transition-all duration-300"
            style={{
              color: isActive ? tab.accent : '#48443c',
              background: isActive ? `rgba(255, 255, 255, 0.03)` : 'transparent',
              border: `1px solid ${isActive ? tab.border : 'transparent'}`,
              boxShadow: isActive ? `0 0 12px ${tab.glow}` : 'none',
            }}
          >
            {tab.label}
            {isActive && (
              <span
                className="absolute bottom-0 left-3 right-3 h-px"
                style={{ background: tab.accent, opacity: 0.5 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
