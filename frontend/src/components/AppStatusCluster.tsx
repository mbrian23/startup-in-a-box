/**
 * Tier-3 status cluster — phase pulse, active agent, deploy/repo chips,
 * activity log popover. Lives in AppHeader; visible in every room.
 *
 * Replaces the live-status row that used to ride along inside the
 * draggable SituationPanel.
 */

import { useEffect, useRef, useState } from 'react';
import type { AgentActivity, AgentPhase } from '../hooks/useAgentActivity';
import { PulseDot } from './artifacts/shared';

const PHASE_LABELS: Record<AgentPhase, string> = {
  idle: 'Idle',
  thinking: 'Thinking',
  researching: 'Researching',
  building: 'Building',
  complete: 'Complete',
  error: 'Error',
};

const PHASE_COLORS: Record<AgentPhase, string> = {
  idle: '#5a5448',
  thinking: '#daa850',
  researching: '#6090ee',
  building: '#6090ee',
  complete: '#50c878',
  error: '#e85050',
};

interface AppStatusClusterProps {
  activity: AgentActivity;
  deploymentUrl: string | null;
  githubUrl: string | null;
  costUsd: number | null;
}

/**
 * Format a running USD cost for the header chip. Keeps three significant
 * digits so $0.0142 renders tight but $1.47 doesn't get padded.
 */
function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  if (cost < 1) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(2)}`;
}

export function AppStatusCluster({ activity, deploymentUrl, githubUrl, costUsd }: AppStatusClusterProps) {
  const phase = activity.phase;
  const phaseColor = PHASE_COLORS[phase];
  const isActive = phase !== 'idle' && phase !== 'complete';

  return (
    <div className="flex items-center gap-3">
      <div
        className="flex items-center gap-2 px-3 h-7 rounded-md"
        style={{
          background: 'rgba(255, 255, 255, 0.025)',
          border: '1px solid rgba(255, 255, 255, 0.04)',
        }}
      >
        <PulseDot color={phaseColor} animate={isActive} />
        <span
          className="font-mono font-semibold uppercase tracking-[0.12em] text-[0.72rem]"
          style={{ color: phaseColor }}
        >
          {PHASE_LABELS[phase]}
        </span>
        {activity.activeAgentDisplay && (
          <>
            <span className="text-[#3a3a40] text-[0.78rem]">·</span>
            <span className="font-mono text-[0.78rem] text-[#d4cbaf] truncate max-w-[160px]">
              {activity.activeAgentDisplay}
            </span>
          </>
        )}
      </div>

      <ActivityLogPopover entries={activity.recentLog} />

      {costUsd !== null && costUsd > 0 && <CostChip cost={costUsd} />}
      {deploymentUrl && <LinkChip url={deploymentUrl} label="Live" color="#50c878" />}
      {githubUrl && <LinkChip url={githubUrl} label="Repo" color="#908878" />}
    </div>
  );
}

function CostChip({ cost }: { cost: number }) {
  const color = '#daa850';
  return (
    <div
      className="flex items-center gap-1 px-2.5 h-7 rounded-md font-mono text-[0.7rem] uppercase tracking-[0.12em]"
      style={{
        color,
        background: `${color}14`,
        border: `1px solid ${color}26`,
      }}
      title={`Factory run cost (cumulative): ${formatCost(cost)}`}
    >
      <span style={{ opacity: 0.7 }}>Cost</span>
      <span style={{ color: '#c8bfa8' }}>{formatCost(cost)}</span>
    </div>
  );
}

function ActivityLogPopover({ entries }: { entries: string[] }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  if (entries.length === 0) return null;

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2.5 h-7 rounded-md cursor-pointer transition-colors"
        style={{
          color: open ? '#c8bfa8' : '#7a7060',
          background: open ? 'rgba(255, 255, 255, 0.04)' : 'transparent',
          border: '1px solid rgba(255, 255, 255, 0.04)',
        }}
      >
        <span className="text-[0.72rem] uppercase tracking-[0.12em] font-mono font-semibold">
          Log
        </span>
        <span className="text-[0.7rem] font-mono text-[#4a4740]">{entries.length}</span>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 w-[340px] rounded-lg overflow-hidden z-50"
          style={{
            background: 'rgba(8, 8, 18, 0.96)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            animation: 'fade-up 0.2s ease-out',
          }}
        >
          <div className="px-3.5 py-2 flex flex-col gap-0.5 max-h-[280px] overflow-y-auto">
            {entries.map((entry, i) => (
              <span
                key={`${entry}-${i}`}
                className="font-mono text-[0.8rem] leading-relaxed py-0.5"
                style={{
                  color: i === 0 ? '#c8bfa8' : `rgba(168, 158, 136, ${Math.max(0.35, 0.85 - i * 0.1)})`,
                }}
              >
                {entry}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LinkChip({ url, label, color }: { url: string; label: string; color: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1 px-2.5 h-7 rounded-md font-mono text-[0.7rem] uppercase tracking-[0.12em] transition-colors hover:opacity-80"
      style={{
        color,
        background: `${color}14`,
        border: `1px solid ${color}26`,
      }}
    >
      {label} ↗
    </a>
  );
}
