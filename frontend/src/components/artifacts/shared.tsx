/**
 * Shared primitives used across all artifact views.
 */

import type { ReactNode } from 'react';
import type { BoardState, LeanCanvas } from '../../hooks/ag-ui/types';

// ─── Artifact type shapes (mirror orchestrator emissions) ─────────────

export interface TargetAudience {
  segments: string[];
  primary: string;
  pain_points: string[];
}
export interface ValueProposition {
  headline: string;
  differentiator: string;
  metric: string;
}
export interface FeatureList {
  must_have: string[];
  should_have: string[];
  out_of_scope: string[];
}
export interface StrategyBoard {
  target_audience: TargetAudience;
  value_proposition: ValueProposition;
  feature_list: FeatureList;
  thought_bubble?: string;
}
export interface MarketAnalysis {
  analysis: string;
  thought_bubble?: string;
}
export interface BuildStep {
  id: string;
  title: string;
  description: string;
  tool_hints: string[];
  outputs: string[];
  depends_on: string[];
}
export interface BuildPlan {
  summary: string;
  steps: BuildStep[];
  tech_stack: string;
  thought_bubble?: string;
}
export interface BuildProgressData {
  steps_completed: number;
  steps_total: number;
}
export interface FileEntry {
  status: string;
  size: number;
}

// ─── Readers (typed narrowing from BoardState) ───────────────────────

export function readStrategy(bs: BoardState): StrategyBoard | null {
  const v = bs.strategy_board;
  return v && typeof v === 'object' && 'value_proposition' in (v as object) ? (v as StrategyBoard) : null;
}
export function readMarket(bs: BoardState): MarketAnalysis | null {
  const v = bs.market_analysis;
  return v && typeof v === 'object' && 'analysis' in (v as object) ? (v as MarketAnalysis) : null;
}
export function readPlan(bs: BoardState): BuildPlan | null {
  const v = bs.build_plan;
  return v && typeof v === 'object' && 'steps' in (v as object) ? (v as BuildPlan) : null;
}
export function readCanvas(bs: BoardState): LeanCanvas | null {
  const v = bs.lean_canvas;
  return v && typeof v === 'object' && 'unique_value_proposition' in (v as object) ? (v as LeanCanvas) : null;
}
export function readProgress(bs: BoardState): BuildProgressData | null {
  const p = bs.progress;
  return p && typeof p === 'object' && 'steps_completed' in (p as object) ? (p as BuildProgressData) : null;
}
export function readStep(bs: BoardState): string | null {
  return typeof bs.current_step === 'string' ? bs.current_step : null;
}
export function readFiles(bs: BoardState): Record<string, FileEntry> {
  const f = bs.files;
  return f && typeof f === 'object' ? (f as Record<string, FileEntry>) : {};
}

// ─── Visual primitives ───────────────────────────────────────────────

export function PulseDot({ color, animate }: { color: string; animate: boolean }) {
  return (
    <span
      className="inline-block w-2 h-2 rounded-full shrink-0"
      style={{
        backgroundColor: color,
        boxShadow: animate ? `0 0 10px ${color}, 0 0 3px ${color}` : 'none',
        animation: animate ? 'pulse-dot 1.4s ease-in-out infinite' : 'none',
        transition: 'background-color 0.3s, box-shadow 0.3s',
      }}
    />
  );
}

export function Placeholder({ label, tone }: { label: string; tone: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center gap-2">
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{
          backgroundColor: tone,
          animation: 'pulse-dot 1.4s ease-in-out infinite',
        }}
      />
      <span className="text-[0.85rem] font-mono" style={{ color: tone, opacity: 0.7 }}>
        {label}
      </span>
      <span className="text-[0.75rem] text-[#6a6760] font-mono">Waiting for agents…</span>
    </div>
  );
}

export function TagList({ items, color }: { items: string[]; color: string }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item}
          className="text-[0.78rem] px-2 py-0.5 rounded font-mono"
          style={{
            color,
            background: `${color}12`,
            border: `1px solid ${color}28`,
          }}
        >
          {item}
        </span>
      ))}
    </div>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return (
    <span className="text-[0.72rem] uppercase tracking-[0.14em] text-[#7a7060] block mb-1.5 font-mono font-semibold">
      {children}
    </span>
  );
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// ─── Minimal markdown parser ─────────────────────────────────────────
// Only what Gemini/Marcus actually emit: `## heading`, `- bullet`,
// `**bold**`, paragraphs, and the auto-appended `Sources:` list.

export type MdBlock =
  | { kind: 'heading'; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'bullets'; items: string[]; sources: boolean };

export function parseMarkdown(src: string): MdBlock[] {
  const blocks: MdBlock[] = [];
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  let i = 0;
  let sourcesActive = false;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '') {
      i += 1;
      continue;
    }
    if (/^sources:\s*$/i.test(line.trim())) {
      sourcesActive = true;
      blocks.push({ kind: 'heading', text: 'Sources' });
      i += 1;
      continue;
    }
    const h = line.match(/^\s*(#{2,3})\s+(.*)$/);
    if (h) {
      blocks.push({ kind: 'heading', text: h[2] });
      i += 1;
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        i += 1;
      }
      blocks.push({ kind: 'bullets', items, sources: sourcesActive });
      continue;
    }
    const paraLines: string[] = [line];
    i += 1;
    while (i < lines.length && lines[i].trim() !== '' && !/^\s*([-*]|#{2,3})\s+/.test(lines[i])) {
      paraLines.push(lines[i]);
      i += 1;
    }
    blocks.push({ kind: 'paragraph', text: paraLines.join(' ') });
  }
  return blocks;
}

// ─── Frame — every artifact view shares the same outer container ────

export function ArtifactFrame({
  children,
  onSavePdf,
}: {
  children: ReactNode;
  onSavePdf?: () => void;
}) {
  return (
    <div
      className="w-full h-full overflow-y-auto"
      style={{
        background: 'rgba(8, 8, 18, 0.62)',
        backdropFilter: 'blur(18px) saturate(1.1)',
        WebkitBackdropFilter: 'blur(18px) saturate(1.1)',
      }}
    >
      <div className="max-w-3xl mx-auto px-8 py-8 relative">
        {onSavePdf && (
          <button
            type="button"
            onClick={onSavePdf}
            className="absolute top-3 right-3 text-[0.7rem] uppercase tracking-[0.14em] font-mono font-semibold px-2.5 py-1 rounded transition-colors hover:brightness-125"
            style={{
              color: 'var(--color-warm-accent)',
              background: 'rgb(var(--color-warm-accent-rgb) / 0.08)',
              border: '1px solid rgb(var(--color-warm-accent-rgb) / 0.28)',
            }}
          >
            Save to PDF
          </button>
        )}
        {children}
      </div>
    </div>
  );
}
