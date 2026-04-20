/**
 * Typed accessors for well-known BoardState fields.
 */

import type { BoardState, FactoryRateLimit, FactoryUsage } from './types';
import type { HandoffStage, PowerState } from '../useHandoffAnimation';

export function readHandoffStage(boardState: BoardState): HandoffStage {
  const v = boardState.handoff_stage;
  if (v === 'preparing' || v === 'launched' || v === 'returned' || v === 'failed') return v;
  return 'idle';
}

export function readPowerState(boardState: BoardState): PowerState {
  const v = boardState.power_state;
  if (v === 'receiving' || v === 'online') return v;
  return 'dark';
}

export function readFactoryProgress(boardState: BoardState): number {
  const v = boardState.factory_progress;
  if (typeof v === 'number' && v >= 0 && v <= 1) return v;
  return 0;
}

export function readDeploymentUrl(boardState: BoardState): string | null {
  const v = boardState.deployment_url;
  return typeof v === 'string' ? v : null;
}

export function readGithubUrl(boardState: BoardState): string | null {
  const v = boardState.github_url;
  return typeof v === 'string' ? v : null;
}

export function readCostUsd(boardState: BoardState): number | null {
  const v = boardState.cost_usd;
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
}

export function readUsage(boardState: BoardState): FactoryUsage | null {
  const v = boardState.usage;
  return v && typeof v === 'object' ? (v as FactoryUsage) : null;
}

export function readRateLimit(boardState: BoardState): FactoryRateLimit | null {
  const v = boardState.rate_limit;
  return v && typeof v === 'object' ? (v as FactoryRateLimit) : null;
}

export function readStderrLine(boardState: BoardState): string | null {
  const v = boardState.cli_stderr_line;
  return typeof v === 'string' && v.length > 0 ? v : null;
}
