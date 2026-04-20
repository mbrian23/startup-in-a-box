/**
 * Tutorial tooltip overlay — presentation mode.
 * Starts open. Click to expand full detail. No auto-close.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { TutorialControls } from '../hooks/useTutorialTooltips';

interface TutorialTooltipProps {
  controls: TutorialControls;
}

export function TutorialTooltip({ controls }: TutorialTooltipProps) {
  const { active: tooltip, dismiss, prev, next, hasPrev, hasNext } = controls;
  const [expanded, setExpanded] = useState(false);

  // Keep expanded state across tooltip changes

  return (
    <AnimatePresence mode="wait">
      {tooltip && (
        <motion.div
          key={tooltip.def.id}
          className="fixed z-50 font-mono"
          style={{ bottom: 24, left: '50%', transform: 'translateX(-50%)', maxWidth: expanded ? 680 : 480, width: '92vw', transition: 'max-width 0.3s ease' }}
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.97 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <div
            className="glass-panel cursor-pointer"
            onClick={() => setExpanded((v) => !v)}
            style={{
              background: 'rgba(12, 12, 24, 0.94)',
              border: `1px solid ${tooltip.def.badgeColor}22`,
              borderRadius: 16,
              boxShadow: `
                0 24px 64px rgba(0, 0, 0, 0.6),
                0 0 0 1px rgba(255, 255, 255, 0.03),
                0 0 40px ${tooltip.def.badgeColor}08,
                inset 0 1px 0 rgba(255, 255, 255, 0.04)
              `,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Top accent line */}
            <div
              className="absolute inset-x-0 top-0 h-px"
              style={{
                background: `linear-gradient(90deg, transparent 15%, ${tooltip.def.badgeColor}80 50%, transparent 85%)`,
              }}
            />

            <div style={{ padding: expanded ? '28px 32px 24px' : '20px 24px 16px', transition: 'padding 0.25s ease' }}>
              {/* Badge row */}
              <div className="flex items-center justify-between mb-2.5">
                <span
                  className="uppercase tracking-[0.18em] font-bold"
                  style={{
                    fontSize: expanded ? '0.72rem' : '0.65rem',
                    color: tooltip.def.badgeColor,
                    padding: expanded ? '4px 12px' : '3px 10px',
                    background: `${tooltip.def.badgeColor}12`,
                    borderRadius: 6,
                    border: `1px solid ${tooltip.def.badgeColor}25`,
                    transition: 'all 0.25s ease',
                  }}
                >
                  {tooltip.def.badge}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[0.65rem] tabular-nums" style={{ color: 'rgba(255,255,255,0.2)' }}>
                    {tooltip.index + 1}/{tooltip.total}
                  </span>
                  <span
                    className="text-[0.7rem]"
                    style={{ color: 'rgba(255,255,255,0.2)', transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}
                  >
                    ›
                  </span>
                </div>
              </div>

              {/* Title */}
              <h2
                className="font-semibold leading-tight"
                style={{
                  color: '#e8e4dc',
                  fontSize: expanded ? '1.65rem' : '1.35rem',
                  marginBottom: expanded ? '16px' : '12px',
                  transition: 'all 0.25s ease',
                }}
              >
                {tooltip.def.title}
              </h2>

              {/* Keywords */}
              <motion.div
                className="flex flex-wrap"
                style={{ gap: expanded ? '8px' : '6px', transition: 'gap 0.25s ease' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.15, duration: 0.4 }}
              >
                {tooltip.def.body.split(' · ').map((item, i) => (
                  <span
                    key={i}
                    className="rounded-md"
                    style={{
                      color: '#c0bbb0',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      fontSize: expanded ? '0.95rem' : '0.8rem',
                      padding: expanded ? '6px 14px' : '4px 10px',
                      transition: 'all 0.25s ease',
                    }}
                  >
                    {item.trim()}
                  </span>
                ))}
              </motion.div>

              {/* Detail — visible when expanded */}
              <AnimatePresence>
                {expanded && tooltip.def.detail && (
                  <motion.p
                    className="leading-relaxed"
                    style={{ color: 'rgba(255,255,255,0.38)', fontSize: '0.9rem', marginTop: 16 }}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                  >
                    {tooltip.def.detail}
                  </motion.p>
                )}
              </AnimatePresence>

              {/* Controls */}
              <div className="flex items-center justify-between" style={{ marginTop: expanded ? 20 : 14, transition: 'margin 0.25s ease' }}>
                <div className="flex items-center gap-1">
                  {[
                    { label: '← Prev', action: prev, enabled: hasPrev },
                    { label: 'Next →', action: next, enabled: hasNext },
                    { label: 'Skip ↵', action: dismiss, enabled: true },
                  ].map((btn) => (
                    <button
                      key={btn.label}
                      onClick={(e) => { e.stopPropagation(); btn.action(); }}
                      disabled={!btn.enabled}
                      className="rounded-md uppercase tracking-[0.16em] font-semibold transition-colors cursor-pointer disabled:cursor-default"
                      style={{
                        fontSize: expanded ? '0.68rem' : '0.62rem',
                        padding: expanded ? '6px 12px' : '6px 10px',
                        background: btn.enabled ? 'rgba(255,255,255,0.04)' : 'transparent',
                        color: btn.enabled ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.08)',
                        border: `1px solid ${btn.enabled ? 'rgba(255,255,255,0.06)' : 'transparent'}`,
                      }}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
