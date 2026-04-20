import type { BoardState } from '../../hooks/ag-ui/types';
import { ArtifactFrame, Label, Placeholder, PulseDot, readProgress, readStep } from './shared';

export function ProgressView({ board }: { board: BoardState }) {
  const progress = readProgress(board);
  const step = readStep(board);

  if (!progress && !step) {
    return (
      <ArtifactFrame>
        <Placeholder label="Build progress" tone="#6090ee" />
      </ArtifactFrame>
    );
  }

  const pct = progress
    ? Math.round((progress.steps_completed / Math.max(progress.steps_total, 1)) * 100)
    : 0;
  const done = progress ? progress.steps_completed >= progress.steps_total : false;

  return (
    <ArtifactFrame>
      <div className="space-y-6">
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label>Progress</Label>
            <span className="text-[0.9rem] font-mono text-[#6090ee]">
              {progress ? `${progress.steps_completed}/${progress.steps_total}` : '—'} · {pct}%
            </span>
          </div>
          <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(96,144,238,0.1)' }}>
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${pct}%`,
                background: done
                  ? 'linear-gradient(90deg, #50c878, #40b868)'
                  : 'linear-gradient(90deg, #4070cc, #6090ee)',
                boxShadow: done
                  ? '0 0 12px rgba(80,200,120,0.45)'
                  : '0 0 12px rgba(96,144,238,0.35)',
              }}
            />
          </div>
        </div>

        {step && (
          <div className="flex items-center gap-2.5">
            <PulseDot color="#6090ee" animate={!done} />
            <span className="text-[0.95rem] text-[#b8c4dc] font-mono">{step}</span>
          </div>
        )}
      </div>
    </ArtifactFrame>
  );
}
