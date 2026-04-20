/**
 * Demo-mode shell — replays a pre-recorded AG-UI run from /api/demo.
 *
 * No CopilotKit, no orchestrator, no factory, no API keys needed.
 * Everything the real App renders (boardroom scene, artifacts, factory
 * transition, deploy panel) works because the data path is identical:
 * events flow through the same useAgUiEvents reducer.
 */

import { useCallback, useEffect, useState } from 'react';
import { SessionResetProvider } from '../lib/session-reset';
import { AppHeader } from './AppHeader';
import { ArtifactRail, type ArtifactId } from './ArtifactRail';
import { BoardroomScreen } from './BoardroomScreen';
import { FactoryScreen } from './FactoryScreen';
import { AgentVisualizer } from '@/components/agent-visualizer';
import { IdeaQuipTransition, pickQuip } from './IdeaQuipTransition';
import { PipelineErrorOverlay } from './PipelineErrorOverlay';
import { HITLPanel } from './HITLPanel';
import { ExecutionTimeline } from './ExecutionTimeline';
import { SharedPixiShell } from '../pixi/screens/SharedPixiShell';
import { StrategyView } from './artifacts/StrategyView';
import { MarketView } from './artifacts/MarketView';
import { CanvasView } from './artifacts/CanvasView';
import { PlanView } from './artifacts/PlanView';
import { ProgressView } from './artifacts/ProgressView';
import { FilesView } from './artifacts/FilesView';
import { DeployView } from './artifacts/DeployView';
import { useDemoEventSource } from '../hooks/useDemoEventSource';
import { useAgentActivity } from '../hooks/useAgentActivity';
import { useAgUiEvents, readHandoffStage } from '../hooks/useAgUiEvents';
import { useAutoFocus } from '../hooks/useAutoFocus';
import { useExecutionTimeline } from '../hooks/useExecutionTimeline';
import { useTutorialTooltips } from '../hooks/useTutorialTooltips';
import { TutorialTooltip } from './TutorialTooltip';
import { BOARDROOM_CHARACTERS, FACTORY_CHARACTERS } from '../data/startup-characters';
import { motion, AnimatePresence } from 'motion/react';

const SCREEN_FADE = { duration: 0.52, ease: [0.4, 0, 0.2, 1] as const };
const ARTIFACT_FADE = { duration: 0.28, ease: [0.4, 0, 0.2, 1] as const };

const DEMO_IDEA = 'Marketplace for half-used candles.';
const IDEA_HOLD_MS = 3000;

export function DemoApp() {
  const threadId = 'demo-thread';
  const player = useDemoEventSource(1);
  const { eventSource, start, isRunning, speed, setSpeed, paused, setPaused } = player;
  const activity = useAgentActivity(eventSource);
  const timeline = useExecutionTimeline(eventSource);

  const boardroomState = useAgUiEvents(eventSource, BOARDROOM_CHARACTERS);
  const factoryState = useAgUiEvents(eventSource, FACTORY_CHARACTERS);

  const handoffStage = readHandoffStage(boardroomState.boardState);
  const { active, switchTo } = useAutoFocus(activity.phase, handoffStage);
  const tooltipControls = useTutorialTooltips(eventSource);

  const [activeArtifact, setActiveArtifact] = useState<ArtifactId>('scene');
  const [prevActive, setPrevActive] = useState(active);
  if (prevActive !== active) {
    setPrevActive(active);
    setActiveArtifact('scene');
  }

  // Show the idea picker briefly, then auto-launch
  const [ideaPhase, setIdeaPhase] = useState<'picking' | 'launched' | 'hidden'>('picking');
  useEffect(() => {
    const t1 = window.setTimeout(() => setIdeaPhase('launched'), IDEA_HOLD_MS);
    const t2 = window.setTimeout(() => {
      setIdeaPhase('hidden');
      void start();
    }, IDEA_HOLD_MS + 600);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Quip overlay on RUN_STARTED
  const [quip, setQuip] = useState<string | null>(null);
  useEffect(() => {
    const unsub = eventSource.subscribe((event) => {
      if (event.type === 'RUN_STARTED') setQuip(pickQuip());
    });
    return () => { unsub?.(); };
  }, [eventSource]);
  useEffect(() => {
    if (!quip) return;
    const t = window.setTimeout(() => setQuip(null), 2400);
    return () => window.clearTimeout(t);
  }, [quip]);

  // Track deployment URLs from events
  const [deploymentUrl, setDeploymentUrl] = useState<string | null>(null);
  const [githubUrl, setGithubUrl] = useState<string | null>(null);
  const [costUsd, setCostUsd] = useState<number | null>(null);
  const [usage, setUsage] = useState<import('../hooks/ag-ui/types').FactoryUsage | null>(null);
  const [numTurns, setNumTurns] = useState<number | null>(null);
  const [durationMs, setDurationMs] = useState<number | null>(null);

  useEffect(() => {
    const unsub = eventSource.subscribe((event) => {
      if (event.type === 'STATE_DELTA' && event.delta) {
        for (const op of event.delta) {
          if (op.path === '/deployment_url' && typeof op.value === 'string') setDeploymentUrl(op.value);
          if (op.path === '/github_url' && typeof op.value === 'string') setGithubUrl(op.value);
          if (op.path === '/cost_usd' && typeof op.value === 'number') setCostUsd(op.value);
          if (op.path === '/usage' && op.value && typeof op.value === 'object') setUsage(op.value as import('../hooks/ag-ui/types').FactoryUsage);
          if (op.path === '/num_turns' && typeof op.value === 'number') setNumTurns(op.value);
          if (op.path === '/duration_ms' && typeof op.value === 'number') setDurationMs(op.value);
        }
      }
    });
    return () => { unsub?.(); };
  }, [eventSource]);

  const [dismissedError, setDismissedError] = useState<string | null>(null);
  const activeErrorMessage =
    activity.errorMessage && activity.errorMessage !== dismissedError
      ? activity.errorMessage
      : null;

  const orchBS = boardroomState.boardState;
  const factBS = factoryState.boardState;

  const restart = useCallback(() => {
    window.location.reload();
  }, []);

  const noop = useCallback(() => {}, []);

  return (
    <SessionResetProvider reset={noop} threadId={threadId}>
    <div className="w-full h-screen bg-[#040406] flex flex-col overflow-hidden font-mono">
      <AppHeader
        active={active}
        onSwitch={switchTo}
        activity={activity}
        deploymentUrl={deploymentUrl}
        githubUrl={githubUrl}
        costUsd={costUsd}
        hideReset
      />

      <ArtifactRail
        active={active}
        artifact={activeArtifact}
        onSelect={setActiveArtifact}
        boardroomBoard={orchBS}
        factoryBoard={factBS}
        deploymentUrl={deploymentUrl}
        githubUrl={githubUrl}
      />

      <div className="flex-1 min-h-0 flex overflow-hidden">
        <div className="flex-1 min-w-0 relative overflow-hidden">
          <div className="absolute inset-0 z-0">
            <SharedPixiShell
              active={active}
              boardroomState={boardroomState}
              phaseBanner={activity.phaseBanner}
            />
          </div>

          {/* Agent-flow visualizer — crossfades with boardroom */}
          <motion.div
            className="absolute inset-0"
            style={{
              zIndex: 5,
              pointerEvents: active === 'factory' && activeArtifact === 'scene' ? 'auto' : 'none',
            }}
            animate={{
              opacity: active === 'factory' ? 1 : 0,
              scale: active === 'factory' ? 1 : 1.015,
            }}
            transition={SCREEN_FADE}
          >
            <div className="dark" style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
              <AgentVisualizer />
            </div>
          </motion.div>

          <div className="absolute inset-0 z-10 pointer-events-none">
            <motion.div
              className="absolute inset-0"
              style={{ pointerEvents: 'none' }}
              animate={{
                opacity: active === 'boardroom' ? 1 : 0,
                scale: active === 'boardroom' ? 1 : 0.985,
              }}
              transition={SCREEN_FADE}
            >
              <BoardroomScreen state={boardroomState} />
            </motion.div>
            <motion.div
              className="absolute inset-0"
              animate={{
                opacity: active === 'factory' ? 1 : 0,
                scale: active === 'factory' ? 1 : 1.015,
              }}
              transition={SCREEN_FADE}
            >
              <FactoryScreen state={factoryState} />
            </motion.div>
          </div>

          <motion.div
            className="absolute inset-0"
            style={{
              zIndex: 15,
              pointerEvents: activeArtifact === 'scene' ? 'none' : 'auto',
            }}
            animate={{ opacity: activeArtifact === 'scene' ? 0 : 1 }}
            transition={ARTIFACT_FADE}
          >
            {activeArtifact !== 'scene' && (
              <ArtifactSurface
                active={active}
                artifact={activeArtifact}
                boardroomBoard={orchBS}
                factoryBoard={factBS}
                deploymentUrl={deploymentUrl}
                githubUrl={githubUrl}
                costUsd={costUsd}
                usage={usage}
                numTurns={numTurns}
                durationMs={durationMs}
              />
            )}
          </motion.div>
        </div>
      </div>

      {active === 'boardroom' && <ExecutionTimeline timeline={timeline} />}

      {/* Demo playback controls */}
      <div className="fixed bottom-5 left-5 z-50 font-mono flex items-center gap-3">
        <div
          className="flex items-center gap-3 rounded-2xl px-4 py-2.5"
          style={{
            background: 'rgba(12,12,20,0.94)',
            border: '1px solid rgba(255,255,255,0.06)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
          }}
        >
          {/* Demo label */}
          <span className="text-[0.62rem] uppercase tracking-[0.22em] font-bold text-[#daa850]">
            Demo
          </span>

          {/* Pause / Play */}
          <button
            onClick={() => setPaused(!paused)}
            className="flex items-center justify-center w-7 h-7 rounded-lg cursor-pointer transition-colors"
            style={{
              background: paused ? 'rgb(var(--color-warm-accent-rgb) / 0.2)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${paused ? 'rgb(var(--color-warm-accent-rgb) / 0.4)' : 'rgba(255,255,255,0.06)'}`,
              color: paused ? '#f2c878' : '#6a6760',
            }}
          >
            <span className="text-[0.75rem]">{paused ? '▶' : '⏸'}</span>
          </button>

          {/* Speed slider */}
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0.5}
              max={4}
              step={0.5}
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="w-16 h-1 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #daa850 0%, #daa850 ${((speed - 0.5) / 3.5) * 100}%, rgba(255,255,255,0.08) ${((speed - 0.5) / 3.5) * 100}%, rgba(255,255,255,0.08) 100%)`,
                accentColor: '#daa850',
              }}
            />
            <span className="text-[0.65rem] tabular-nums text-[#6a6760] w-8 text-right">
              {speed}×
            </span>
          </div>
        </div>
      </div>

      {/* Replay button when done */}
      {!isRunning && activity.phase !== 'idle' && ideaPhase === 'hidden' && (
        <div className="fixed bottom-5 right-5 z-50 font-mono">
          <button
            onClick={restart}
            className="rounded-full px-5 py-3 cursor-pointer text-[0.85rem] uppercase tracking-[0.22em] font-semibold"
            style={{
              background: 'rgba(12,12,20,0.92)',
              border: '1px solid rgba(218,168,80,0.28)',
              color: '#daa850',
            }}
          >
            Replay demo
          </button>
        </div>
      )}

      <PipelineErrorOverlay
        message={activeErrorMessage}
        onDismiss={() => setDismissedError(activity.errorMessage)}
      />

      <HITLPanel hitl={orchBS.hitl ?? null} threadId={threadId} autoApproveRef={{ current: true }} />

      <IdeaQuipTransition active={quip !== null} quip={quip} />

      {/* Tutorial tooltips — contextual onboarding cards */}
      <TutorialTooltip controls={tooltipControls} />

      {/* Demo idea picker — mirrors the real IdeaLauncher hero picker */}
      <AnimatePresence>
        {ideaPhase !== 'hidden' && (
          <motion.div
            className="fixed inset-0 z-40 flex items-center justify-center p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{
              background:
                'radial-gradient(ellipse at center, rgba(4,4,6,0.78) 0%, rgba(4,4,6,0.96) 70%)',
              backdropFilter: 'blur(14px) saturate(1.2)',
              WebkitBackdropFilter: 'blur(14px) saturate(1.2)',
            }}
          >
            <motion.div
              className="relative w-full max-w-[640px] overflow-hidden rounded-2xl"
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.97 }}
              transition={{ duration: 0.42, ease: [0.4, 0, 0.2, 1] }}
              style={{
                background:
                  'linear-gradient(180deg, rgba(18,18,28,0.88) 0%, rgba(10,10,18,0.92) 100%)',
                border: '1px solid rgb(var(--color-warm-accent-rgb) / 0.22)',
                boxShadow:
                  '0 24px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.03), inset 0 1px 0 rgba(255,255,255,0.06)',
              }}
            >
              <motion.div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-px"
                style={{
                  background:
                    'linear-gradient(90deg, transparent 0%, rgb(var(--color-warm-accent-rgb) / 0.9) 50%, transparent 100%)',
                }}
                animate={{ backgroundPosition: ['0% 0', '200% 0'] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
              />

              <div className="px-8 pt-8 pb-3 font-mono">
                <div className="text-[0.75rem] uppercase tracking-[0.24em] text-[#6a6760] mb-2">
                  Startup in a Box · Demo
                </div>
                <h2 className="text-[1.75rem] font-semibold text-[#f0ece4] leading-tight">
                  Pick a terrible idea.
                </h2>
                <p className="text-[0.95rem] text-[#8a857a] mt-1.5">
                  Watch the AI boardroom debate, plan, and build it live.
                </p>
              </div>

              <div className="px-4 pb-6 pt-2">
                <motion.div
                  className="relative flex w-full items-center gap-4 rounded-xl px-4 py-3 font-mono"
                  animate={{
                    background: ideaPhase === 'launched'
                      ? 'linear-gradient(90deg, rgb(var(--color-warm-accent-rgb) / 0.22), rgb(var(--color-warm-accent-rgb) / 0.06))'
                      : 'linear-gradient(90deg, rgb(var(--color-warm-accent-rgb) / 0.12), rgb(var(--color-warm-accent-rgb) / 0.04))',
                    boxShadow: ideaPhase === 'launched'
                      ? 'inset 0 0 0 1px rgb(var(--color-warm-accent-rgb) / 0.55), 0 0 22px rgb(var(--color-warm-accent-rgb) / 0.12)'
                      : 'inset 0 0 0 1px rgb(var(--color-warm-accent-rgb) / 0.3), 0 0 0 transparent',
                  }}
                  transition={{ duration: 0.3 }}
                >
                  <motion.span
                    aria-hidden
                    className="absolute left-0 top-1/2 -translate-y-1/2 h-7 w-[3px] rounded-r-full"
                    style={{
                      background: 'linear-gradient(180deg, #f2c878 0%, #daa850 100%)',
                      boxShadow: '0 0 12px rgb(var(--color-warm-accent-rgb) / 0.8)',
                    }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                  />
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[0.8rem] tabular-nums font-semibold"
                    style={{
                      background: 'rgb(var(--color-warm-accent-rgb) / 0.28)',
                      color: '#f2c878',
                      border: '1px solid rgb(var(--color-warm-accent-rgb) / 0.5)',
                    }}
                  >
                    1
                  </span>
                  <span className="flex-1 text-[1rem] leading-snug" style={{ color: '#f8f1dc' }}>
                    {DEMO_IDEA}
                  </span>
                  <motion.span
                    aria-hidden
                    className="text-[0.85rem]"
                    style={{ color: '#f2c878' }}
                    animate={ideaPhase === 'launched' ? { opacity: [1, 0.3, 1] } : {}}
                    transition={{ duration: 0.6, repeat: 0 }}
                  >
                    {ideaPhase === 'launched' ? '⏎' : '↵'}
                  </motion.span>
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </SessionResetProvider>
  );
}

interface ArtifactSurfaceProps {
  active: 'boardroom' | 'factory';
  artifact: Exclude<ArtifactId, 'scene'>;
  boardroomBoard: ReturnType<typeof useAgUiEvents>['boardState'];
  factoryBoard: ReturnType<typeof useAgUiEvents>['boardState'];
  deploymentUrl: string | null;
  githubUrl: string | null;
  costUsd: number | null;
  usage: import('../hooks/ag-ui/types').FactoryUsage | null;
  numTurns: number | null;
  durationMs: number | null;
}

function ArtifactSurface({
  active,
  artifact,
  boardroomBoard,
  factoryBoard,
  deploymentUrl,
  githubUrl,
  costUsd,
  usage,
  numTurns,
  durationMs,
}: ArtifactSurfaceProps) {
  if (artifact === 'plan') {
    return active === 'factory' ? (
      <PlanView board={boardroomBoard} progressBoard={factoryBoard} mode="live" />
    ) : (
      <PlanView board={boardroomBoard} mode="designed" />
    );
  }
  if (artifact === 'strategy') return <StrategyView board={boardroomBoard} />;
  if (artifact === 'market') return <MarketView board={boardroomBoard} />;
  if (artifact === 'canvas') return <CanvasView board={boardroomBoard} />;
  if (artifact === 'progress') return <ProgressView board={factoryBoard} />;
  if (artifact === 'files') return <FilesView board={factoryBoard} />;
  if (artifact === 'deploy') return (
    <DeployView
      deploymentUrl={deploymentUrl}
      githubUrl={githubUrl}
      costUsd={costUsd}
      usage={usage}
      numTurns={numTurns}
      durationMs={durationMs}
    />
  );
  return null;
}
