/**
 * Shared HITL decision type -- TypeScript mirror of
 * factory/src/factory/hitl/decisions.py HitlDecision.
 *
 * Field names and optionality MUST match the Python TypedDict exactly.
 */

export interface HitlDecision {
  approved: boolean;
  reason?: string;
  modifications?: Record<string, unknown>; // out of scope for v1, always empty
}

export type RiskLevel = 'low' | 'medium' | 'high';
