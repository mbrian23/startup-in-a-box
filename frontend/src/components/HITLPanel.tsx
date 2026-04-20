/**
 * Human-in-the-loop approval gate between boardroom and factory.
 *
 * Appears when the orchestrator pauses the pipeline after the CEO's
 * `start_factory` tool call — the backend emits a STATE_DELTA that
 * sets `board.hitl = { status: 'awaiting', build_plan, ... }`. Approve
 * releases delegation to the factory; Reject surfaces notes and
 * terminates the run so the user can launch a fresh idea.
 */

'use client';

import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { HITLState, HITLBuildStep } from '../hooks/ag-ui/types';

export type { HITLState };

interface HITLPanelProps {
  hitl: HITLState | null;
  threadId: string;
  autoApproveRef: RefObject<boolean>;
}

export function HITLPanel({ hitl, threadId, autoApproveRef }: HITLPanelProps) {
  const open = hitl?.status === 'awaiting';
  const buildPlan = hitl?.build_plan;

  const [submitting, setSubmitting] = useState<'approve' | 'reject' | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState('');

  const submit = useCallback(
    async (approved: boolean) => {
      if (submitting) return;
      setSubmitting(approved ? 'approve' : 'reject');
      try {
        await fetch('/api/hitl', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ thread_id: threadId, approved, notes: approved ? '' : notes }),
        });
      } catch {
        // Orchestrator's future is single-shot; a stray failure here is
        // recoverable by pressing the button again. No toast needed.
        setSubmitting(null);
      }
    },
    [submitting, threadId, notes],
  );

  const AUTO_APPROVE_MS = 6000;
  const autoApproved = useRef(false);
  const [autoCancelled, setAutoCancelled] = useState(false);
  const [autoRemaining, setAutoRemaining] = useState<number | null>(null);
  useEffect(() => {
    if (!open) {
      autoApproved.current = false;
      setAutoCancelled(false);
      setAutoRemaining(null);
    }
  }, [open]);
  useEffect(() => {
    if (
      !open ||
      autoApproved.current ||
      submitting ||
      autoCancelled ||
      !autoApproveRef.current
    ) {
      setAutoRemaining(null);
      return;
    }
    const started = performance.now();
    setAutoRemaining(AUTO_APPROVE_MS);
    const tick = window.setInterval(() => {
      const left = AUTO_APPROVE_MS - (performance.now() - started);
      setAutoRemaining(left > 0 ? left : 0);
    }, 80);
    const timer = window.setTimeout(() => {
      autoApproved.current = true;
      void submit(true);
    }, AUTO_APPROVE_MS);
    return () => {
      window.clearInterval(tick);
      window.clearTimeout(timer);
    };
  }, [open, submitting, autoCancelled, submit, autoApproveRef]);
  const autoProgress =
    autoRemaining === null ? 0 : 1 - autoRemaining / AUTO_APPROVE_MS;
  const autoSecondsLeft =
    autoRemaining === null ? null : Math.max(0, Math.ceil(autoRemaining / 1000));

  const stepCount = useMemo(() => buildPlan?.steps?.length ?? 0, [buildPlan]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-label="Approve build plan before factory"
          className="fixed inset-0 z-[200] flex items-center justify-center p-6"
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
            className="relative w-full max-w-[680px] overflow-hidden rounded-2xl"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.42, ease: [0.4, 0, 0.2, 1] }}
            style={{
              background:
                'linear-gradient(180deg, rgba(18,18,28,0.9) 0%, rgba(10,10,18,0.94) 100%)',
              border: '1px solid rgb(var(--color-warm-accent-rgb) / 0.22)',
              boxShadow:
                '0 24px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.03), inset 0 1px 0 rgba(255,255,255,0.06)',
            }}
          >
            {/* Gold shimmer */}
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

            {/* Auto-approve countdown bar */}
            {autoSecondsLeft !== null && (
              <div
                aria-hidden
                className="absolute inset-x-0 top-0 h-[3px] overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.04)' }}
              >
                <div
                  className="h-full"
                  style={{
                    width: `${autoProgress * 100}%`,
                    background:
                      'linear-gradient(90deg, rgb(var(--color-warm-accent-rgb) / 0.6), rgb(var(--color-warm-accent-rgb) / 1))',
                    transition: 'width 80ms linear',
                  }}
                />
              </div>
            )}

            <div className="px-8 pt-8 pb-3 font-mono">
              <div className="text-[0.75rem] uppercase tracking-[0.24em] text-[#6a6760] mb-2">
                Approval gate · {stepCount} steps · {buildPlan?.tech_stack ?? 'no stack'}
              </div>
              <h2 className="text-[1.6rem] font-semibold text-[#f0ece4] leading-tight">
                Ship this plan to the factory?
              </h2>
              {buildPlan?.summary && (
                <p className="text-[0.95rem] text-[#a8a397] mt-2 leading-snug">
                  {buildPlan.summary}
                </p>
              )}
            </div>

            <ul className="px-6 pb-2 pt-1 max-h-[42vh] overflow-y-auto space-y-1 font-mono">
              {(buildPlan?.steps ?? []).map((step: HITLBuildStep, i: number) => (
                <li
                  key={step.id ?? i}
                  className="flex gap-3 rounded-md px-3 py-2"
                  style={{ background: 'rgba(255,255,255,0.02)' }}
                >
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[0.72rem] tabular-nums font-semibold"
                    style={{
                      background: 'rgb(var(--color-warm-accent-rgb) / 0.16)',
                      color: '#daa850',
                      border: '1px solid rgb(var(--color-warm-accent-rgb) / 0.28)',
                    }}
                  >
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[0.9rem] text-[#e0ddd4] truncate">
                      {step.title ?? step.id ?? 'step'}
                    </div>
                    {step.description && (
                      <div className="text-[0.78rem] text-[#6a6760] mt-0.5 line-clamp-2">
                        {step.description}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            <AnimatePresence initial={false}>
              {showNotes && (
                <motion.div
                  key="notes"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="px-6 pt-3 overflow-hidden"
                >
                  <textarea
                    autoFocus
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="What's wrong with the plan? (optional)"
                    rows={3}
                    className="w-full rounded-md bg-transparent p-3 font-mono text-[0.88rem] text-[#e0ddd4] placeholder:text-[#4a4740] outline-none"
                    style={{
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {autoSecondsLeft !== null && (
              <div
                className="flex items-center justify-between gap-3 px-6 pt-3 pb-1 font-mono text-[0.72rem] uppercase tracking-[0.22em]"
                style={{ color: '#daa850' }}
              >
                <span>Auto-approving in {autoSecondsLeft}s</span>
                <button
                  type="button"
                  onClick={() => setAutoCancelled(true)}
                  className="rounded px-2 py-1 text-[0.68rem] uppercase tracking-[0.2em] cursor-pointer transition-colors"
                  style={{
                    color: '#a8a397',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  Cancel
                </button>
              </div>
            )}

            <div
              className="flex items-center justify-between gap-3 px-6 py-4 mt-2 font-mono"
              style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
            >
              <button
                type="button"
                onClick={() => {
                  if (showNotes) {
                    void submit(false);
                  } else {
                    setShowNotes(true);
                  }
                }}
                disabled={submitting !== null}
                className="rounded-md px-4 py-2 text-[0.78rem] uppercase tracking-[0.2em] font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed"
                style={{
                  color: '#ffb0b0',
                  background: 'rgba(232, 80, 80, 0.08)',
                  border: '1px solid rgba(232, 80, 80, 0.25)',
                  opacity: submitting === 'approve' ? 0.4 : 1,
                }}
              >
                {submitting === 'reject'
                  ? 'Rejecting…'
                  : showNotes
                    ? 'Confirm reject'
                    : 'Reject'}
              </button>

              <button
                type="button"
                onClick={() => void submit(true)}
                disabled={submitting !== null}
                autoFocus
                className="rounded-md px-5 py-2 text-[0.78rem] uppercase tracking-[0.22em] font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed"
                style={{
                  color: '#f2c878',
                  background:
                    'linear-gradient(135deg, rgb(var(--color-warm-accent-rgb) / 0.24), rgb(var(--color-warm-accent-rgb) / 0.08))',
                  border: '1px solid rgb(var(--color-warm-accent-rgb) / 0.4)',
                  opacity: submitting === 'reject' ? 0.4 : 1,
                }}
              >
                {submitting === 'approve' ? 'Shipping…' : 'Approve & ship ↵'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
