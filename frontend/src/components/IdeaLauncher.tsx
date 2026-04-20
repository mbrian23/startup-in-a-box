/**
 * Autonomous idea launcher — the only way to start the pipeline.
 *
 *   idle (never ran)  → full-screen hero picker with 10 curated ideas
 *   running           → compact status pill, non-interactive
 *   complete / error  → small "spawn another unicorn" FAB
 *
 * Picking an idea pushes a user message onto the AG-UI agent and calls
 * runAgent(), so the orchestrator pipeline receives it exactly as if the
 * user had typed in a chat — events flow through useCopilotEventBridge
 * untouched.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAgUiClient } from '../lib/ag-ui-client';
import type { AgentPhase } from '../hooks/useAgentActivity';

function pickSample<T>(pool: readonly T[], n: number): T[] {
  const copy = [...pool];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(n, copy.length));
}

const IDEAS: string[] = [
  'Uber, but for regret.',
  'Dating app exclusively for people who hate dating apps.',
  'Airbnb where the host stays the whole time.',
  'Blockchain-powered composting bin.',
  'Subscription box for expired coupons.',
  'LinkedIn where everyone is contractually obligated to be honest.',
  'An AI that argues with your smart fridge.',
  'Marketplace for half-used candles.',
  'Slack for goldfish owners.',
  'Netflix, but every film is exactly eleven minutes.',
];

interface IdeaLauncherProps {
  phase: AgentPhase;
  isRunning: boolean;
  onReset: () => void;
  onAutoApproveChange: (value: boolean) => void;
}

export function IdeaLauncher({ phase, isRunning, onReset, onAutoApproveChange }: IdeaLauncherProps) {
  const { launch: agUiLaunch, isStreaming } = useAgUiClient();
  // Idle, never touched → hero picker is open. After a run completes or
  // errors, the picker stays closed until user clicks the spawn button.
  const [open, setOpen] = useState(phase === 'idle');
  const [launching, setLaunching] = useState<string | null>(null);

  const LS_KEY = 'siab-auto-approve';
  const [autoApprove, setAutoApprove] = useState(() => {
    try { return localStorage.getItem(LS_KEY) !== 'false'; } catch { return true; }
  });
  const initialSynced = useRef(false);
  useEffect(() => {
    if (!initialSynced.current) { initialSynced.current = true; onAutoApproveChange(autoApprove); }
  }, [autoApprove, onAutoApproveChange]);
  const toggleAutoApprove = useCallback((v: boolean) => {
    setAutoApprove(v);
    onAutoApproveChange(v);
    try { localStorage.setItem(LS_KEY, String(v)); } catch { /* quota */ }
  }, [onAutoApproveChange]);

  useEffect(() => {
    if (phase === 'idle' && !isRunning) setOpen(true);
  }, [phase, isRunning]);

  const canLaunch = !isRunning && !isStreaming && !launching;

  const launch = useCallback(
    (idea: string) => {
      if (!canLaunch) return;
      setLaunching(idea);
      agUiLaunch(idea);
      // Leave the flash on briefly so users see the chosen idea highlight,
      // then close. RUN_STARTED will flip isRunning on its own arrival.
      window.setTimeout(() => {
        setOpen(false);
        setLaunching(null);
      }, 420);
    },
    [canLaunch, agUiLaunch],
  );

  // Shuffle a fresh sample of 3 ideas each time the picker reopens so
  // spawning another unicorn doesn't show the same three options twice.
  const [sample, setSample] = useState<string[]>(() => pickSample(IDEAS, 3));
  const [selectedIdx, setSelectedIdx] = useState(-1);
  useEffect(() => {
    if (open) {
      setSample(pickSample(IDEAS, 3));
      setSelectedIdx(-1);
    }
  }, [open]);

  // Keyboard shortcuts — 1..3 pick the sampled ideas; ↑/↓ move the accent
  // cursor and Enter launches the highlighted idea; Esc closes; "/" reopens.
  // Keys that would collide with normal typing (digits, arrows, Enter) are
  // skipped when a text field is focused so the custom-idea input wins.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isRunning) return;
      if (e.key === 'Escape' && open) {
        if (phase === 'idle') return; // can't close the hero gate
        setOpen(false);
        return;
      }
      if (e.key === '/' && !open) {
        e.preventDefault();
        setOpen(true);
        return;
      }
      if (!open) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIdx((prev) => (prev + 1) % sample.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIdx((prev) => (prev <= 0 ? sample.length - 1 : prev - 1));
        return;
      }
      if (e.key === 'Enter' && selectedIdx >= 0 && selectedIdx < sample.length) {
        e.preventDefault();
        launch(sample[selectedIdx]);
        return;
      }
      const idx = Number(e.key) - 1;
      if (idx >= 0 && idx < sample.length) {
        launch(sample[idx]);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, phase, isRunning, sample, selectedIdx, launch]);

  const mode: 'hero' | 'status' | 'done' = isRunning
    ? 'status'
    : phase === 'idle'
      ? 'hero'
      : 'done';

  return (
    <>
      <AnimatePresence>
        {open && !isRunning && (
          <HeroPicker
            key="hero"
            ideas={sample}
            launching={launching}
            selectedIdx={selectedIdx}
            onHover={setSelectedIdx}
            onPick={launch}
            onClose={phase === 'idle' ? null : () => setOpen(false)}
            mode={mode}
            autoApprove={autoApprove}
            onAutoApproveChange={toggleAutoApprove}
          />
        )}
      </AnimatePresence>

      {/* Floating corner widget — spawn button when complete; live status lives in AppHeader */}
      <AnimatePresence>
        {mode === 'done' && !open && (
          <SpawnButton
            key="spawn"
            phase={phase}
            onOpen={() => setOpen(true)}
            onReset={onReset}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Hero picker ──────────────────────────────────────────────────────

function HeroPicker({
  ideas,
  launching,
  selectedIdx,
  onHover,
  onPick,
  onClose,
  mode,
  autoApprove,
  onAutoApproveChange,
}: {
  ideas: string[];
  launching: string | null;
  selectedIdx: number;
  onHover: (idx: number) => void;
  onPick: (idea: string) => void;
  onClose: (() => void) | null;
  mode: 'hero' | 'done' | 'status';
  autoApprove: boolean;
  onAutoApproveChange: (value: boolean) => void;
}) {
  const ease = useMemo(() => [0.4, 0, 0.2, 1] as const, []);
  const [custom, setCustom] = useState('');
  const title = mode === 'hero' ? 'Pick a terrible idea.' : 'Spawn another unicorn.';
  const subtitle =
    mode === 'hero'
      ? 'Type your own below, or grab one of the curated atrocities.'
      : 'Fresh thread, fresh agents, fresh regret.';

  const submitCustom = () => {
    const trimmed = custom.trim();
    if (!trimmed || launching !== null) return;
    onPick(trimmed);
  };

  return (
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
      onClick={onClose ?? undefined}
    >
      {/* Subtle grid texture — fades into the glass */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      <motion.div
        role="dialog"
        aria-label="Choose a startup idea"
        className="relative w-full max-w-[640px] overflow-hidden rounded-2xl"
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.97 }}
        transition={{ duration: 0.42, ease }}
        style={{
          background:
            'linear-gradient(180deg, rgba(18,18,28,0.88) 0%, rgba(10,10,18,0.92) 100%)',
          border: '1px solid rgb(var(--color-warm-accent-rgb) / 0.22)',
          boxShadow:
            '0 24px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.03), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Gold hairline shimmer across the top */}
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
            Startup in a Box · Autonomous Run
          </div>
          <h2 className="text-[1.75rem] font-semibold text-[#f0ece4] leading-tight">
            {title}
          </h2>
          <p className="text-[0.95rem] text-[#8a857a] mt-1.5">{subtitle}</p>
        </div>

        <div className="px-6 pb-3 pt-1 font-mono">
          <div
            className="group flex items-center gap-3 rounded-xl px-4 py-3
              transition-colors focus-within:border-gold/40"
            style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <span className="text-[0.95rem] text-gold/80 shrink-0 select-none">{'>'}</span>
            <input
              type="text"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submitCustom();
                }
              }}
              disabled={launching !== null}
              placeholder="Describe your own terrible startup idea..."
              className="flex-1 bg-transparent border-none outline-none font-mono
                text-[0.95rem] text-[#e0ddd4] placeholder:text-[#4a4740]
                disabled:opacity-50"
            />
            <button
              onClick={submitCustom}
              disabled={launching !== null || !custom.trim()}
              className="shrink-0 rounded-md px-3 py-1 font-mono
                text-[0.75rem] uppercase tracking-[0.2em] font-semibold
                transition-colors cursor-pointer disabled:cursor-not-allowed"
              style={{
                background: custom.trim() ? 'rgb(var(--color-warm-accent-rgb) / 0.16)' : 'rgba(255,255,255,0.03)',
                color: custom.trim() ? '#daa850' : '#4a4740',
                border: `1px solid ${custom.trim() ? 'rgb(var(--color-warm-accent-rgb) / 0.3)' : 'rgba(255,255,255,0.05)'}`,
              }}
            >
              Launch ↵
            </button>
          </div>
          <div
            className="flex items-center gap-3 pt-3 pb-1
              text-[0.72rem] uppercase tracking-[0.22em] text-[#3a3840]"
          >
            <span className="h-px flex-1 bg-[rgba(255,255,255,0.04)]" />
            <span>or pick one</span>
            <span className="h-px flex-1 bg-[rgba(255,255,255,0.04)]" />
          </div>
        </div>

        <ul className="px-4 pb-4 pt-1 space-y-1">
          {ideas.map((idea, i) => {
            const key = String(i + 1);
            const isLaunching = launching === idea;
            const isDimmed = launching !== null && !isLaunching;
            const isCursor = selectedIdx === i && launching === null;
            const isHighlighted = isLaunching || isCursor;
            return (
              <motion.li
                key={idea}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: isDimmed ? 0.25 : 1, x: 0 }}
                transition={{ delay: 0.05 + i * 0.035, duration: 0.3, ease }}
              >
                <button
                  onClick={() => onPick(idea)}
                  onMouseEnter={() => onHover(i)}
                  onFocus={() => onHover(i)}
                  disabled={launching !== null}
                  className="group relative flex w-full items-center gap-4 rounded-xl px-4 py-3
                    text-left font-mono transition-all cursor-pointer
                    disabled:cursor-not-allowed
                    focus:outline-none"
                  style={{
                    background: isHighlighted
                      ? 'linear-gradient(90deg, rgb(var(--color-warm-accent-rgb) / 0.22), rgb(var(--color-warm-accent-rgb) / 0.06))'
                      : 'transparent',
                    boxShadow: isHighlighted
                      ? 'inset 0 0 0 1px rgb(var(--color-warm-accent-rgb) / 0.55), 0 0 22px rgb(var(--color-warm-accent-rgb) / 0.12)'
                      : 'inset 0 0 0 1px transparent',
                  }}
                >
                  {isCursor && (
                    <motion.span
                      aria-hidden
                      layoutId="idea-cursor-rail"
                      className="absolute left-0 top-1/2 -translate-y-1/2 h-7 w-[3px] rounded-r-full"
                      style={{
                        background:
                          'linear-gradient(180deg, #f2c878 0%, #daa850 100%)',
                        boxShadow: '0 0 12px rgb(var(--color-warm-accent-rgb) / 0.8)',
                      }}
                      transition={{ type: 'spring', stiffness: 500, damping: 36 }}
                    />
                  )}
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md
                      text-[0.8rem] tabular-nums font-semibold
                      transition-colors"
                    style={{
                      background: isHighlighted
                        ? 'rgb(var(--color-warm-accent-rgb) / 0.28)'
                        : 'rgba(255,255,255,0.04)',
                      color: isHighlighted ? '#f2c878' : '#6a6760',
                      border: `1px solid ${
                        isHighlighted ? 'rgb(var(--color-warm-accent-rgb) / 0.5)' : 'rgba(255,255,255,0.06)'
                      }`,
                    }}
                  >
                    {key}
                  </span>
                  <span
                    className="flex-1 text-[1rem] leading-snug transition-colors"
                    style={{ color: isHighlighted ? '#f8f1dc' : '#d0cdc4' }}
                  >
                    {idea}
                  </span>
                  <span
                    aria-hidden
                    className="text-[0.85rem] transition-colors"
                    style={{ color: isHighlighted ? '#f2c878' : '#3a3840' }}
                  >
                    ↵
                  </span>
                </button>
              </motion.li>
            );
          })}
        </ul>

        <div
          className="flex items-center justify-between px-6 py-3 font-mono
            text-[0.72rem] uppercase tracking-[0.18em] text-[#4a4740]"
          style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
        >
          <span>↑ ↓ to move · ↵ to launch · 1–3 jump</span>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => onAutoApproveChange(!autoApprove)}
              className="flex items-center gap-2 cursor-pointer transition-colors"
              style={{ color: autoApprove ? '#daa850' : '#4a4740' }}
            >
              <span
                className="relative inline-block w-7 h-4 rounded-full transition-colors"
                style={{
                  background: autoApprove
                    ? 'rgb(var(--color-warm-accent-rgb) / 0.35)'
                    : 'rgba(255,255,255,0.06)',
                  border: `1px solid ${autoApprove ? 'rgb(var(--color-warm-accent-rgb) / 0.5)' : 'rgba(255,255,255,0.1)'}`,
                }}
              >
                <span
                  className="absolute top-[2px] h-2.5 w-2.5 rounded-full transition-all"
                  style={{
                    background: autoApprove ? '#daa850' : '#4a4740',
                    left: autoApprove ? '12px' : '2px',
                  }}
                />
              </span>
              Auto-approve
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="text-[#6a6760] hover:text-[#c0bdb4] transition-colors cursor-pointer"
              >
                Esc · close
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Done / FAB ───────────────────────────────────────────────────────

function SpawnButton({
  phase,
  onOpen,
  onReset,
}: {
  phase: AgentPhase;
  onOpen: () => void;
  onReset: () => void;
}) {
  const label = phase === 'error' ? 'Try another idea' : 'Spawn another unicorn';
  const tone = phase === 'error' ? 'text-[#ff9b9b]' : 'text-gold';
  return (
    <motion.div
      className="fixed bottom-5 right-5 z-40 font-mono flex items-center gap-2"
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.96 }}
      transition={{ duration: 0.32 }}
    >
      <button
        onClick={() => {
          onReset();
          onOpen();
        }}
        className="group relative overflow-hidden rounded-full px-5 py-3 cursor-pointer"
        style={{
          background: 'rgba(12,12,20,0.92)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgb(var(--color-warm-accent-rgb) / 0.28)',
          boxShadow: '0 10px 32px rgba(0,0,0,0.6), 0 0 24px rgb(var(--color-warm-accent-rgb) / 0.06)',
        }}
      >
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.35, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            background:
              'radial-gradient(circle at 30% 50%, rgb(var(--color-warm-accent-rgb) / 0.35), transparent 60%)',
          }}
        />
        <span className={`relative text-[0.85rem] uppercase tracking-[0.22em] font-semibold ${tone}`}>
          {label}
        </span>
      </button>
    </motion.div>
  );
}
