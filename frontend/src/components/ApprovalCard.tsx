/**
 * HITL approval card — glassmorphism modal with refined risk indicators
 * and polished interactive elements.
 */

import { useState } from 'react';
import type { RiskLevel, HitlDecision } from '../lib/hitl';

const RISK_CONFIG: Record<RiskLevel, { color: string; bg: string; border: string; glow: string; label: string }> = {
  low: {
    color: '#50c878',
    bg: 'rgba(80, 200, 120, 0.1)',
    border: 'rgba(80, 200, 120, 0.25)',
    glow: 'rgba(80, 200, 120, 0.08)',
    label: 'Low Risk',
  },
  medium: {
    color: '#f0a830',
    bg: 'rgba(240, 168, 48, 0.1)',
    border: 'rgba(240, 168, 48, 0.25)',
    glow: 'rgba(240, 168, 48, 0.08)',
    label: 'Medium Risk',
  },
  high: {
    color: '#e85050',
    bg: 'rgba(232, 80, 80, 0.1)',
    border: 'rgba(232, 80, 80, 0.25)',
    glow: 'rgba(232, 80, 80, 0.08)',
    label: 'High Risk',
  },
};

export interface ApprovalCardProps {
  readonly summary: string;
  readonly risk: RiskLevel;
  readonly onRespond: (decision: HitlDecision) => void;
}

export function ApprovalCard({ summary, risk, onRespond }: ApprovalCardProps) {
  const [denyReason, setDenyReason] = useState('');
  const cfg = RISK_CONFIG[risk];

  const handleApprove = () => {
    onRespond({ approved: true });
  };

  const handleDeny = () => {
    onRespond({
      approved: false,
      reason: denyReason || 'denied by user',
    });
  };

  return (
    <div
      data-testid="approval-card"
      className="glass-panel"
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        padding: '24px 32px',
        background: 'rgba(12, 12, 24, 0.92)',
        color: '#e8e4dc',
        borderRadius: '16px',
        border: `1px solid ${cfg.border}`,
        boxShadow: `
          0 24px 64px rgba(0, 0, 0, 0.6),
          0 0 0 1px rgba(255, 255, 255, 0.03),
          0 0 40px ${cfg.glow},
          inset 0 1px 0 rgba(255, 255, 255, 0.04)
        `,
        minWidth: '340px',
        maxWidth: '420px',
        zIndex: 100,
        animation: 'fade-up 0.3s ease-out',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
        <span
          data-testid="risk-badge"
          style={{
            padding: '3px 12px',
            background: cfg.bg,
            color: cfg.color,
            borderRadius: '6px',
            fontSize: '0.78rem',
            fontWeight: 700,
            fontFamily: "'JetBrains Mono', monospace",
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            border: `1px solid ${cfg.border}`,
          }}
        >
          {cfg.label}
        </span>
        <span style={{
          fontSize: '1rem',
          fontWeight: 600,
          fontFamily: "'JetBrains Mono', monospace",
          letterSpacing: '0.02em',
        }}>
          Approval Required
        </span>
      </div>

      {/* Summary */}
      <p
        data-testid="approval-summary"
        style={{
          fontSize: '0.95rem',
          lineHeight: 1.6,
          margin: '0 0 20px 0',
          color: '#c0bab0',
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        {summary}
      </p>

      {/* Deny reason input */}
      <input
        data-testid="deny-reason-input"
        type="text"
        placeholder="Reason for denial (optional)"
        value={denyReason}
        onChange={(e) => setDenyReason(e.target.value)}
        style={{
          width: '100%',
          padding: '10px 14px',
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '10px',
          color: '#e8e4dc',
          fontSize: '0.85rem',
          fontFamily: "'JetBrains Mono', monospace",
          marginBottom: '20px',
          boxSizing: 'border-box',
          outline: 'none',
          transition: 'border-color 0.2s',
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'; }}
      />

      {/* Actions */}
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
        <button
          data-testid="deny-button"
          onClick={handleDeny}
          style={{
            padding: '9px 22px',
            background: 'rgba(232, 80, 80, 0.08)',
            border: '1px solid rgba(232, 80, 80, 0.2)',
            borderRadius: '10px',
            color: '#e85050',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: 600,
            fontFamily: "'JetBrains Mono', monospace",
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(232, 80, 80, 0.15)';
            e.currentTarget.style.borderColor = 'rgba(232, 80, 80, 0.35)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(232, 80, 80, 0.08)';
            e.currentTarget.style.borderColor = 'rgba(232, 80, 80, 0.2)';
          }}
        >
          Deny
        </button>
        <button
          data-testid="approve-button"
          onClick={handleApprove}
          style={{
            padding: '9px 22px',
            background: 'rgba(80, 200, 120, 0.1)',
            border: '1px solid rgba(80, 200, 120, 0.25)',
            borderRadius: '10px',
            color: '#50c878',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: 600,
            fontFamily: "'JetBrains Mono', monospace",
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(80, 200, 120, 0.18)';
            e.currentTarget.style.borderColor = 'rgba(80, 200, 120, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(80, 200, 120, 0.1)';
            e.currentTarget.style.borderColor = 'rgba(80, 200, 120, 0.25)';
          }}
        >
          Approve
        </button>
      </div>
    </div>
  );
}
