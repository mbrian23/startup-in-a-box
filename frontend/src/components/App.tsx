/**
 * Single-page shell — one room at a time, auto-switches on pipeline
 * phase transitions.
 *
 * Three-tier IA:
 *   Tier 1 (rooms)      — Boardroom, Factory  (places agents inhabit)
 *   Tier 2 (artifacts)  — room-scoped tabs in ArtifactRail (docs produced)
 *   Tier 3 (live state) — phase + agent + log + chips in AppStatusCluster
 *
 * A single shared <Application> (SharedPixiShell) is mounted beneath the
 * per-screen HTML chrome so the GL context and Assets cache survive swaps.
 * When an artifact tab is selected, a full-area overlay covers the scene.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { useSessionReset } from '../lib/session-reset';
import { useAgUiClient } from '../lib/ag-ui-client';
import { AppHeader } from './AppHeader';
import { ArtifactRail, type ArtifactId } from './ArtifactRail';
import { BoardroomScreen } from './BoardroomScreen';
import { FactoryScreen } from './FactoryScreen';
import { FactoryVisualizer } from './FactoryVisualizer';
import { IdeaLauncher } from './IdeaLauncher';
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
import { useAgentActivity } from '../hooks/useAgentActivity';
import { useAgUiEvents, readHandoffStage } from '../hooks/useAgUiEvents';
import { useAutoFocus } from '../hooks/useAutoFocus';
import { useExecutionTimeline } from '../hooks/useExecutionTimeline';
import { useTutorialTooltips } from '../hooks/useTutorialTooltips';
import { TutorialTooltip } from './TutorialTooltip';
import { BOARDROOM_CHARACTERS, FACTORY_CHARACTERS } from '../data/startup-characters';

// Shared tween for every boardroom ↔ factory crossfade so the three
// layers (pixi shell, HTML chrome, factory visualizer) stay in lockstep.
const SCREEN_FADE = { duration: 0.52, ease: [0.4, 0, 0.2, 1] as const };
const ARTIFACT_FADE = { duration: 0.28, ease: [0.4, 0, 0.2, 1] as const };

export function App() {
  // threadId is the reset signal — every event-consuming hook takes it so
  // its in-memory state clears atomically when the thread rotates, without
  // unmounting the Pixi canvas or the agent-flow visualizer.
  const { reset: rotateThread, threadId } = useSessionReset();

  const { eventSource: orchestratorEvents, abortRun } = useAgUiClient();
  const activity = useAgentActivity(orchestratorEvents);
  const timeline = useExecutionTimeline(orchestratorEvents);

  const [tutorialEnabled] = useState(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('tutorial'),
  );
  const tooltipControls = useTutorialTooltips(
    orchestratorEvents,
    tutorialEnabled,
  );

  // Reset + abort: aborting the AG-UI run closes the orchestrator HTTP
  // stream, which asyncio-cancels the ADK loop and — via delegate_to_factory
  // — the factory's Claude Agent SDK subprocess. Rotating threadId after
  // that gives the fresh run a clean slate.
  const resetAndAbort = useCallback(() => {
    abortRun();
    rotateThread();
  }, [abortRun, rotateThread]);

  // Auto-approve HITL gate — set at launch time, consumed once by HITLPanel.
  const autoApproveRef = useRef(false);

  // Hide the pipeline error overlay once dismissed, but re-show if a
  // fresh RUN_ERROR arrives with a different message.
  const [dismissedError, setDismissedError] = useState<string | null>(null);
  const activeErrorMessage =
    activity.errorMessage && activity.errorMessage !== dismissedError
      ? activity.errorMessage
      : null;

  // Lift AG-UI subscriptions above the screen-swap boundary so scene state
  // persists even when the active screen changes.
  const boardroomState = useAgUiEvents(orchestratorEvents, BOARDROOM_CHARACTERS);
  const factoryState = useAgUiEvents(orchestratorEvents, FACTORY_CHARACTERS);

  const handoffStage = readHandoffStage(boardroomState.boardState);
  const { active, switchTo } = useAutoFocus(activity.phase, handoffStage);

  // Artifact selection — always reset to 'scene' when the room changes,
  // because rooms are places and Scene is each room's "home" view.
  const [activeArtifact, setActiveArtifact] = useState<ArtifactId>('scene');
  const [prevActive, setPrevActive] = useState(active);
  if (prevActive !== active) {
    setPrevActive(active);
    setActiveArtifact('scene');
  }

  // Quip overlay — fires on RUN_STARTED with a fresh random roast,
  // dismisses after a beat so the boardroom can take over.
  const [quip, setQuip] = useState<string | null>(null);
  useEffect(() => {
    const unsub = orchestratorEvents.subscribe((event) => {
      if (event.type === 'RUN_STARTED') setQuip(pickQuip());
    });
    return () => { unsub?.(); };
  }, [orchestratorEvents]);
  useEffect(() => {
    if (!quip) return;
    const t = window.setTimeout(() => setQuip(null), 2400);
    return () => window.clearTimeout(t);
  }, [quip]);

  // Track deployment URLs + factory run accounting from the orchestrator
  // stream. Cost/usage come from the Claude Agent SDK's ResultMessage,
  // forwarded as a STATE_DELTA so the deploy panel can render them next
  // to the URL chips.
  const [deploymentUrl, setDeploymentUrl] = useState<string | null>(null);
  const [githubUrl, setGithubUrl] = useState<string | null>(null);
  const [costUsd, setCostUsd] = useState<number | null>(null);
  const [usage, setUsage] = useState<import('../hooks/ag-ui/types').FactoryUsage | null>(null);
  const [numTurns, setNumTurns] = useState<number | null>(null);
  const [durationMs, setDurationMs] = useState<number | null>(null);

  // Render-phase clear of carry-over UI state on thread rotation.
  const [prevThreadId, setPrevThreadId] = useState(threadId);
  if (prevThreadId !== threadId) {
    setPrevThreadId(threadId);
    setDismissedError(null);
    setQuip(null);
    setDeploymentUrl(null);
    setGithubUrl(null);
    setCostUsd(null);
    setUsage(null);
    setNumTurns(null);
    setDurationMs(null);
    setActiveArtifact('scene');
  }
  useEffect(() => {
    const unsub = orchestratorEvents.subscribe((event) => {
      if (event.type === 'STATE_DELTA' && event.delta) {
        for (const op of event.delta) {
          if (op.path === '/deployment_url' && typeof op.value === 'string') {
            setDeploymentUrl(op.value as string);
          }
          if (op.path === '/github_url' && typeof op.value === 'string') {
            setGithubUrl(op.value as string);
          }
          if (op.path === '/cost_usd' && typeof op.value === 'number') {
            setCostUsd(op.value as number);
          }
          if (op.path === '/usage' && op.value && typeof op.value === 'object') {
            setUsage(op.value as import('../hooks/ag-ui/types').FactoryUsage);
          }
          if (op.path === '/num_turns' && typeof op.value === 'number') {
            setNumTurns(op.value as number);
          }
          if (op.path === '/duration_ms' && typeof op.value === 'number') {
            setDurationMs(op.value as number);
          }
        }
      }
    });
    return () => { unsub?.(); };
  }, [orchestratorEvents]);

  const orchBS = boardroomState.boardState;
  const factBS = factoryState.boardState;

  return (
    <div className="w-full h-screen bg-[#040406] flex flex-col overflow-hidden font-mono">
      <AppHeader
        active={active}
        onSwitch={switchTo}
        activity={activity}
        deploymentUrl={deploymentUrl}
        githubUrl={githubUrl}
        costUsd={costUsd}
        onReset={resetAndAbort}
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

      {/* Main content — scene layers + optional artifact overlay */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        <div className="flex-1 min-w-0 relative overflow-hidden">
          {/* Shared Pixi canvas — mounted once, survives screen swaps */}
          <div className="absolute inset-0 z-0">
            <SharedPixiShell
              active={active}
              boardroomState={boardroomState}
              phaseBanner={activity.phaseBanner}
            />
          </div>

          {/* Persistent agent-flow visualizer — mounted once, crossfaded by opacity. */}
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
            <FactoryVisualizer />
          </motion.div>

          {/* Per-screen HTML chrome layered above the canvas. */}
          <div className="absolute inset-0 z-10 pointer-events-none">
            <motion.div
              className="absolute inset-0"
              // Chrome stays non-interactive as a whole. Interactive
              // children (OverridesPanel) opt back in with their own
              // pointerEvents: 'auto' so clicks pass through to the
              // Pixi canvas below and TileDebugOverlay dots can be hit.
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

          {/* Artifact overlay — covers scene chrome when an artifact tab is selected. */}
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

      {/* Execution timeline — boardroom only; factory has its own visualizer */}
      {active === 'boardroom' && <ExecutionTimeline timeline={timeline} />}

      {/* Idea launcher — pick a curated prompt; pipeline runs autonomously */}
      <IdeaLauncher
        phase={activity.phase}
        isRunning={activity.isRunning}
        onReset={resetAndAbort}
        onAutoApproveChange={(v) => { autoApproveRef.current = v; }}
      />

      {/* Pipeline error alert — fires on RUN_ERROR from any agent stream */}
      <PipelineErrorOverlay
        message={activeErrorMessage}
        onDismiss={() => setDismissedError(activity.errorMessage)}
      />

      {/* HITL gate — pauses pipeline between boardroom and factory for
          human approval. `hitl` lands on the boardroom board via
          STATE_DELTA from the orchestrator's /hitl path. */}
      <HITLPanel hitl={orchBS.hitl ?? null} threadId={threadId} autoApproveRef={autoApproveRef} />

      {/* Cinematic quip curtain — plays briefly when a run starts. */}
      <IdeaQuipTransition active={quip !== null} quip={quip} />

      {/* Tutorial tooltips — ?tutorial URL param enables them */}
      {tutorialEnabled && <TutorialTooltip controls={tooltipControls} />}
    </div>
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
  // Plan renders in both rooms with different lenses.
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
