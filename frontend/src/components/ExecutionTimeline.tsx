/**
 * Horizontal execution timeline — shows agent segments as colored bars
 * with elapsed time. Appears at the bottom of the active screen.
 */

import { useEffect, useState } from 'react';
import type { ExecutionTimelineState, TimelineSegment } from '../hooks/useExecutionTimeline';

// Ticks "now" forward while the run is active so in-progress bars grow
// visibly between SSE events. React purity rules forbid Date.now() in
// render, so we surface it through state instead.
function useNow(active: boolean, intervalMs = 500): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs]);
  return now;
}

const AGENT_COLORS: Record<string, string> = {
  data_structurer: '#daa850',
  market_analyst: '#6090ee',
  architect: '#a070dd',
  factory: '#50c878',
};

function segmentColor(agent: string): string {
  return AGENT_COLORS[agent] ?? '#888';
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

function SegmentBar({
  segment,
  totalMs,
  now,
  flexBasisPct,
}: {
  segment: TimelineSegment;
  totalMs: number;
  now: number;
  flexBasisPct: number;
}) {
  const duration = (segment.endMs ?? now) - segment.startMs;
  const color = segmentColor(segment.agent);
  const isActive = segment.endMs === null;

  return (
    <div
      className="relative h-full rounded-sm overflow-hidden group shrink-0"
      style={{
        flex: `${flexBasisPct} 1 0`,
        minWidth: '120px',
        background: `${color}20`,
        border: `1px solid ${color}40`,
        transition: 'flex-grow 0.5s ease-out',
      }}
    >
      {/* Fill bar */}
      <div
        className="absolute inset-y-0 left-0 rounded-sm"
        style={{
          width: '100%',
          background: `${color}30`,
          animation: isActive ? 'breathe-glow 2s ease-in-out infinite' : 'none',
        }}
      />
      {/* Label */}
      <div className="relative z-10 flex items-center justify-between h-full px-2">
        <span
          className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] truncate"
          style={{ color }}
        >
          {segment.displayName}
        </span>
        <span className="text-[0.65rem] opacity-60 shrink-0 ml-1" style={{ color }}>
          {formatDuration(duration)}
        </span>
      </div>
      {/* Tooltip on hover — tools used */}
      {segment.tools.length > 0 && (
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-20"
          style={{
            background: 'rgba(8, 8, 18, 0.95)',
            border: `1px solid ${color}30`,
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          }}
        >
          <span className="text-[0.7rem] opacity-50" style={{ color }}>
            {segment.tools.join(' → ')}
          </span>
        </div>
      )}
    </div>
  );
}

interface ExecutionTimelineProps {
  timeline: ExecutionTimelineState;
}

export function ExecutionTimeline({ timeline }: ExecutionTimelineProps) {
  const hasSegments = timeline.segments.length > 0;
  // Only tick while a run is actively in progress. Before the first segment
  // arrives the component reserves its space but stays visually idle.
  const isRunning = hasSegments && timeline.runEndMs === null;
  const now = useNow(isRunning);

  const totalMs = hasSegments
    ? (timeline.runEndMs ?? now) - (timeline.runStartMs ?? now)
    : 0;
  const elapsed = hasSegments && totalMs > 0 ? formatDuration(totalMs) : '—';

  return (
    <div
      className="glass-panel-subtle"
      style={{
        background: 'rgba(8, 8, 18, 0.8)',
        borderTop: '1px solid rgba(255, 255, 255, 0.04)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[0.72rem] uppercase tracking-[0.12em] text-[#605848] font-semibold">
            Timeline
          </span>
          {isRunning && (
            <span
              className="inline-block w-[5px] h-[5px] rounded-full"
              style={{
                backgroundColor: '#50c878',
                boxShadow: '0 0 6px rgba(80, 200, 120, 0.5)',
                animation: 'pulse-dot 1.4s ease-in-out infinite',
              }}
            />
          )}
        </div>
        <span className="text-[0.7rem] text-[#48443c] font-mono">{elapsed}</span>
      </div>
      {/* Bar — scrolls horizontally when the task count exceeds the width
          available for readable labels. Always kept at the same height so
          the page doesn't snap down when the first segment arrives. */}
      <div className="flex gap-px px-4 pb-2 h-8 overflow-x-auto overflow-y-hidden">
        {hasSegments ? (
          timeline.segments.map((seg, i) => {
            const duration = (seg.endMs ?? now) - seg.startMs;
            const basis = totalMs > 0 ? Math.max((duration / totalMs) * 100, 4) : 25;
            return (
              <SegmentBar
                key={`${seg.agent}-${i}`}
                segment={seg}
                totalMs={totalMs}
                now={now}
                flexBasisPct={basis}
              />
            );
          })
        ) : (
          <div className="flex items-center text-[0.65rem] uppercase tracking-[0.12em] text-[#3a362e]">
            awaiting run…
          </div>
        )}
      </div>
    </div>
  );
}
