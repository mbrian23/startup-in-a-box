/**
 * Tests for ApprovalCard component.
 *
 * Covers: rendering each risk level, approve callback shape,
 * deny callback shape with reason, deny without reason.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ApprovalCard } from '../../src/components/ApprovalCard';
import type { HitlDecision, RiskLevel } from '../../src/lib/hitl';

describe('ApprovalCard', () => {
  afterEach(() => {
    cleanup();
  });

  const defaultProps = {
    summary: 'Create new file: main.py',
    risk: 'medium' as RiskLevel,
    onRespond: vi.fn(),
  };

  it('renders the summary text', () => {
    render(<ApprovalCard {...defaultProps} />);

    expect(screen.getByTestId('approval-summary').textContent).toBe(
      'Create new file: main.py',
    );
  });

  it('renders low risk badge', () => {
    render(<ApprovalCard {...defaultProps} risk="low" />);

    expect(screen.getByTestId('risk-badge').textContent).toBe('Low Risk');
  });

  it('renders medium risk badge', () => {
    render(<ApprovalCard {...defaultProps} risk="medium" />);

    expect(screen.getByTestId('risk-badge').textContent).toBe('Medium Risk');
  });

  it('renders high risk badge', () => {
    render(<ApprovalCard {...defaultProps} risk="high" />);

    expect(screen.getByTestId('risk-badge').textContent).toBe('High Risk');
  });

  it('when clicking Approve, responds with approved true', () => {
    const onRespond = vi.fn();
    render(<ApprovalCard {...defaultProps} onRespond={onRespond} />);

    fireEvent.click(screen.getByTestId('approve-button'));

    expect(onRespond).toHaveBeenCalledOnce();
    const decision: HitlDecision = onRespond.mock.calls[0][0];
    expect(decision.approved).toBe(true);
  });

  it('when clicking Deny without reason, responds with default reason', () => {
    const onRespond = vi.fn();
    render(<ApprovalCard {...defaultProps} onRespond={onRespond} />);

    fireEvent.click(screen.getByTestId('deny-button'));

    expect(onRespond).toHaveBeenCalledOnce();
    const decision: HitlDecision = onRespond.mock.calls[0][0];
    expect(decision.approved).toBe(false);
    expect(decision.reason).toBe('denied by user');
  });

  it('when clicking Deny with custom reason, includes the reason', () => {
    const onRespond = vi.fn();
    render(<ApprovalCard {...defaultProps} onRespond={onRespond} />);

    const input = screen.getByTestId('deny-reason-input');
    fireEvent.change(input, { target: { value: 'too dangerous' } });
    fireEvent.click(screen.getByTestId('deny-button'));

    expect(onRespond).toHaveBeenCalledOnce();
    const decision: HitlDecision = onRespond.mock.calls[0][0];
    expect(decision.approved).toBe(false);
    expect(decision.reason).toBe('too dangerous');
  });

  it('renders the approval card container', () => {
    render(<ApprovalCard {...defaultProps} />);

    expect(screen.getByTestId('approval-card')).toBeTruthy();
  });
});
