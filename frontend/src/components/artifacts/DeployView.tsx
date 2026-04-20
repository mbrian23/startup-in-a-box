/**
 * Deploy artifact — promoted from a header chip into a first-class
 * Factory artifact. Shows the live deployment URL with an iframe
 * preview and surrounding metadata (repo link, run cost, timing).
 */

import type { FactoryUsage } from '../../hooks/ag-ui/types';
import { ArtifactFrame, Label, Placeholder, PulseDot } from './shared';

interface DeployViewProps {
  deploymentUrl: string | null;
  githubUrl: string | null;
  costUsd: number | null;
  usage: FactoryUsage | null;
  numTurns: number | null;
  durationMs: number | null;
}

function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  if (cost < 1) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(2)}`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remSeconds = Math.round(seconds - minutes * 60);
  return `${minutes}m ${remSeconds}s`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function DeployView({
  deploymentUrl,
  githubUrl,
  costUsd,
  usage,
  numTurns,
  durationMs,
}: DeployViewProps) {
  const hasRunData =
    (costUsd !== null && costUsd > 0) ||
    (numTurns !== null && numTurns > 0) ||
    (durationMs !== null && durationMs > 0) ||
    (usage !== null && Object.values(usage).some((v) => typeof v === 'number' && v > 0));

  if (!deploymentUrl && !githubUrl && !hasRunData) {
    return (
      <ArtifactFrame>
        <Placeholder label="Deployment" tone="#50c878" />
      </ArtifactFrame>
    );
  }

  return (
    <ArtifactFrame>
      <div className="space-y-6">
        {deploymentUrl && (
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <PulseDot color="#50c878" animate={true} />
              <Label>Live</Label>
              <a
                href={deploymentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto text-[0.85rem] font-mono text-[#80bbff] hover:text-[#a0d0ff] transition-colors"
                style={{ borderBottom: '1px solid rgba(128, 187, 255, 0.3)' }}
              >
                Open in new tab ↗
              </a>
            </div>
            <a
              href={deploymentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-[0.9rem] font-mono text-[#80bbff] mb-3 truncate"
            >
              {deploymentUrl}
            </a>
            <div
              className="rounded-lg overflow-hidden"
              style={{
                border: '1px solid rgba(96, 144, 238, 0.18)',
                background: 'rgba(0, 0, 0, 0.5)',
                aspectRatio: '16 / 10',
              }}
            >
              <iframe
                src={deploymentUrl}
                title="Deployment preview"
                className="w-full h-full"
                style={{ border: 'none', background: '#fff' }}
                sandbox="allow-scripts allow-same-origin allow-forms"
              />
            </div>
          </div>
        )}

        {githubUrl && (
          <div>
            <Label>Repository</Label>
            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[0.9rem] font-mono text-[#a89e88] hover:text-[#c8bfa8] transition-colors"
              style={{ borderBottom: '1px solid rgba(168, 158, 136, 0.25)' }}
            >
              {githubUrl} ↗
            </a>
          </div>
        )}

        {hasRunData && (
          <RunCostPanel
            costUsd={costUsd}
            usage={usage}
            numTurns={numTurns}
            durationMs={durationMs}
          />
        )}
      </div>
    </ArtifactFrame>
  );
}

interface RunCostPanelProps {
  costUsd: number | null;
  usage: FactoryUsage | null;
  numTurns: number | null;
  durationMs: number | null;
}

/**
 * Factory run accounting panel — sits alongside the repo link so the
 * user sees what a build actually cost next to what it produced.
 * Values come from the Claude Agent SDK's ResultMessage, accumulated
 * across the factory run on the server.
 */
function RunCostPanel({ costUsd, usage, numTurns, durationMs }: RunCostPanelProps) {
  return (
    <div>
      <Label>Run</Label>
      <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2 text-[0.85rem] font-mono">
        {costUsd !== null && costUsd > 0 && (
          <MetricRow label="Cost" value={formatCost(costUsd)} tone="#daa850" />
        )}
        {numTurns !== null && numTurns > 0 && (
          <MetricRow label="Turns" value={String(numTurns)} tone="#8a857a" />
        )}
        {durationMs !== null && durationMs > 0 && (
          <MetricRow label="Duration" value={formatDuration(durationMs)} tone="#8a857a" />
        )}
        {usage?.input_tokens !== undefined && usage.input_tokens > 0 && (
          <MetricRow label="Input tokens" value={formatTokens(usage.input_tokens)} tone="#6090ee" />
        )}
        {usage?.output_tokens !== undefined && usage.output_tokens > 0 && (
          <MetricRow label="Output tokens" value={formatTokens(usage.output_tokens)} tone="#50c878" />
        )}
        {usage?.cache_read_input_tokens !== undefined && usage.cache_read_input_tokens > 0 && (
          <MetricRow
            label="Cache hits"
            value={formatTokens(usage.cache_read_input_tokens)}
            tone="#a070dd"
          />
        )}
      </div>
    </div>
  );
}

function MetricRow({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[0.72rem] uppercase tracking-[0.12em]" style={{ color: '#7a7060' }}>
        {label}
      </span>
      <span style={{ color: tone }}>{value}</span>
    </div>
  );
}
