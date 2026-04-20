/**
 * Room-scoped artifact tab strip. Sits below AppHeader.
 *
 * Boardroom rail: ◉ Scene · Strategy · Market · Canvas · Plan
 * Factory rail:   ◉ Scene · Progress · Plan · Files · Deploy
 *
 * Tabs always render — empty artifacts show muted with a "no data yet"
 * dot so the user sees the full set of artifacts a room can produce.
 */

import type { ActiveScreen } from '../hooks/useAutoFocus';
import type { BoardState } from '../hooks/ag-ui/types';
import {
  readCanvas,
  readFiles,
  readMarket,
  readPlan,
  readProgress,
  readStep,
  readStrategy,
} from './artifacts/shared';

export type BoardroomArtifact = 'scene' | 'strategy' | 'market' | 'canvas' | 'plan';
export type FactoryArtifact = 'scene' | 'progress' | 'plan' | 'files' | 'deploy';
export type ArtifactId = BoardroomArtifact | FactoryArtifact;

interface TabDef {
  id: ArtifactId;
  label: string;
  color: string;
}

const SCENE_TAB: TabDef = { id: 'scene', label: 'Scene', color: '#c8bfa8' };

const BOARDROOM_TABS: TabDef[] = [
  SCENE_TAB,
  { id: 'strategy', label: 'Strategy', color: '#daa850' },
  { id: 'market', label: 'Market', color: '#6090ee' },
  { id: 'canvas', label: 'Canvas', color: '#c29b52' },
  { id: 'plan', label: 'Plan', color: '#a070dd' },
];

const FACTORY_TABS: TabDef[] = [
  SCENE_TAB,
  { id: 'progress', label: 'Progress', color: '#6090ee' },
  { id: 'plan', label: 'Plan', color: '#a070dd' },
  { id: 'files', label: 'Files', color: '#50c878' },
  { id: 'deploy', label: 'Deploy', color: '#50c878' },
];

interface ArtifactRailProps {
  active: ActiveScreen;
  artifact: ArtifactId;
  onSelect: (id: ArtifactId) => void;
  boardroomBoard: BoardState;
  factoryBoard: BoardState;
  deploymentUrl: string | null;
  githubUrl: string | null;
}

function hasData(
  id: ArtifactId,
  boardroom: BoardState,
  factory: BoardState,
  deploymentUrl: string | null,
  githubUrl: string | null,
): boolean {
  switch (id) {
    case 'scene':
      return true;
    case 'strategy':
      return readStrategy(boardroom) !== null;
    case 'market':
      return readMarket(boardroom) !== null;
    case 'canvas':
      return readCanvas(boardroom) !== null;
    case 'plan':
      return readPlan(boardroom) !== null;
    case 'progress':
      return readProgress(factory) !== null || readStep(factory) !== null;
    case 'files':
      return Object.keys(readFiles(factory)).length > 0;
    case 'deploy': {
      const costUsd = factory.cost_usd;
      const hasCost = typeof costUsd === 'number' && costUsd > 0;
      return deploymentUrl !== null || githubUrl !== null || hasCost;
    }
  }
}

function dataBadge(
  id: ArtifactId,
  factory: BoardState,
  deploymentUrl: string | null,
): { text: string; color: string } | null {
  if (id === 'files') {
    const n = Object.keys(readFiles(factory)).length;
    return n > 0 ? { text: String(n), color: '#50c878' } : null;
  }
  if (id === 'progress') {
    const p = readProgress(factory);
    if (!p) return null;
    return { text: `${p.steps_completed}/${p.steps_total}`, color: '#6090ee' };
  }
  if (id === 'deploy' && deploymentUrl) {
    return { text: 'live', color: '#50c878' };
  }
  return null;
}

export function ArtifactRail({
  active,
  artifact,
  onSelect,
  boardroomBoard,
  factoryBoard,
  deploymentUrl,
  githubUrl,
}: ArtifactRailProps) {
  const tabs = active === 'boardroom' ? BOARDROOM_TABS : FACTORY_TABS;
  const accent = active === 'boardroom' ? '#daa850' : '#6090ee';

  return (
    <div
      className="flex items-center gap-1 px-6 h-10 shrink-0 overflow-x-auto"
      style={{
        background: 'rgba(8, 8, 14, 0.55)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
      }}
    >
      {tabs.map((tab) => {
        const isActive = artifact === tab.id;
        const isScene = tab.id === 'scene';
        const populated = hasData(tab.id, boardroomBoard, factoryBoard, deploymentUrl, githubUrl);
        const badge = dataBadge(tab.id, factoryBoard, deploymentUrl);
        const color = isActive ? tab.color : populated ? '#8a857a' : '#48443c';

        return (
          <button
            key={tab.id}
            onClick={() => onSelect(tab.id)}
            className="px-3 h-7 rounded text-[0.78rem] font-semibold uppercase tracking-[0.1em] transition-all cursor-pointer shrink-0 flex items-center gap-1.5"
            style={{
              color,
              background: isActive ? `${tab.color}10` : 'transparent',
              border: `1px solid ${isActive ? `${tab.color}2a` : 'transparent'}`,
            }}
          >
            {isScene && (
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  backgroundColor: isActive ? accent : '#4a4740',
                  boxShadow: isActive ? `0 0 6px ${accent}` : 'none',
                }}
              />
            )}
            {tab.label}
            {badge && (
              <span
                className="text-[0.7rem] px-1.5 py-px rounded font-mono"
                style={{
                  color: badge.color,
                  background: `${badge.color}14`,
                }}
              >
                {badge.text}
              </span>
            )}
            {!isScene && !populated && !badge && (
              <span
                className="w-1 h-1 rounded-full"
                style={{
                  backgroundColor: '#4a4740',
                  animation: isActive ? 'pulse-dot 1.4s ease-in-out infinite' : 'none',
                }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
