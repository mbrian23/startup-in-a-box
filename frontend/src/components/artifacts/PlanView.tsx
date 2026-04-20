/**
 * PlanView renders the build plan in two modes.
 *
 *   designed — Boardroom view: static, chronological. "Here's what we'll build."
 *   live     — Factory view: active step pulses, completed steps greyed,
 *              upcoming steps muted. "Here's what we're building right now."
 *
 * Same artifact data; the lens differs by where you are in the pipeline.
 */

import type { BoardState } from '../../hooks/ag-ui/types';
import { planToPdfHtml, savePdf } from '../../lib/artifact-pdf';
import {
  ArtifactFrame,
  Label,
  Placeholder,
  PulseDot,
  readPlan,
  readProgress,
  readStep,
  type BuildStep,
} from './shared';

interface PlanViewProps {
  /** Boardroom board — the source of truth for build_plan. */
  board: BoardState;
  /** Factory board — only consulted in live mode for progress + current_step. */
  progressBoard?: BoardState;
  mode: 'designed' | 'live';
}

type StepStatus = 'done' | 'active' | 'pending';

function classifyStep(
  step: BuildStep,
  index: number,
  stepsCompleted: number,
  currentStep: string | null,
): StepStatus {
  if (index < stepsCompleted) return 'done';
  if (currentStep && (step.title === currentStep || step.id === currentStep)) return 'active';
  if (index === stepsCompleted) return 'active';
  return 'pending';
}

const STATUS_TONES: Record<StepStatus, { number: string; title: string; desc: string; bg: string; accent: string }> = {
  done: {
    number: '#4a4d40',
    title: '#6a7860',
    desc: '#4e5a48',
    bg: 'rgba(80, 200, 120, 0.04)',
    accent: '#50c878',
  },
  active: {
    number: '#6090ee',
    title: '#d4ccea',
    desc: '#a896c0',
    bg: 'rgba(96, 144, 238, 0.08)',
    accent: '#6090ee',
  },
  pending: {
    number: '#706080',
    title: '#a89cc0',
    desc: '#7a6c90',
    bg: 'rgba(255, 255, 255, 0.025)',
    accent: '#a070dd',
  },
};

export function PlanView({ board, progressBoard, mode }: PlanViewProps) {
  const plan = readPlan(board);

  if (!plan) {
    return (
      <ArtifactFrame>
        <Placeholder label="Build plan" tone="#a070dd" />
      </ArtifactFrame>
    );
  }

  const live = mode === 'live' && progressBoard !== undefined;
  const progress = live ? readProgress(progressBoard) : null;
  const currentStep = live ? readStep(progressBoard) : null;
  const stepsCompleted = progress?.steps_completed ?? 0;

  return (
    <ArtifactFrame onSavePdf={() => savePdf('Build Plan', planToPdfHtml(plan))}>
      <div className="space-y-5">
        <p className="text-[0.95rem] text-[#c8c0dc] font-mono leading-relaxed">{plan.summary}</p>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[0.72rem] uppercase tracking-wider text-[#706080] font-mono font-semibold">
            Stack
          </span>
          <span
            className="text-[0.85rem] px-2.5 py-0.5 rounded font-mono"
            style={{
              color: '#a070dd',
              background: 'rgba(160, 112, 221, 0.1)',
              border: '1px solid rgba(160, 112, 221, 0.2)',
            }}
          >
            {plan.tech_stack}
          </span>
          {live && progress && (
            <span className="ml-auto text-[0.85rem] font-mono text-[#6090ee]">
              {stepsCompleted}/{progress.steps_total} ·{' '}
              {Math.round((stepsCompleted / Math.max(progress.steps_total, 1)) * 100)}%
            </span>
          )}
        </div>

        {live && <Label>Execution</Label>}

        <div className="space-y-2">
          {plan.steps.map((step, i) => {
            const status: StepStatus = live
              ? classifyStep(step, i, stepsCompleted, currentStep)
              : 'pending';
            const tones = STATUS_TONES[status];
            return (
              <div
                key={step.id}
                className="flex items-start gap-3 py-2.5 px-3 rounded transition-colors"
                style={{
                  background: tones.bg,
                  borderLeft: `2px solid ${status === 'active' ? tones.accent : 'transparent'}`,
                }}
              >
                <span
                  className="text-[0.85rem] shrink-0 font-mono tabular-nums w-6 text-right pt-px"
                  style={{ color: tones.number }}
                >
                  {status === 'done' ? '✓' : `${i + 1}.`}
                </span>
                <div className="flex-1 min-w-0">
                  <span
                    className="text-[0.95rem] font-semibold font-mono block"
                    style={{ color: tones.title, textDecoration: status === 'done' ? 'line-through' : 'none' }}
                  >
                    {step.title}
                  </span>
                  <span
                    className="text-[0.82rem] font-mono leading-relaxed block mt-0.5"
                    style={{ color: tones.desc }}
                  >
                    {step.description}
                  </span>
                </div>
                {status === 'active' && (
                  <span className="pt-1.5">
                    <PulseDot color={tones.accent} animate={true} />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </ArtifactFrame>
  );
}
