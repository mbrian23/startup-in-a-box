/**
 * Presentation notes — scrollable review of all tutorial tooltips.
 * Click to expand/collapse. Access via ?notes in the URL.
 */

'use client';

import { useEffect, useState } from 'react';

interface TooltipEntry {
  id: string;
  title: string;
  body: string;
  detail?: string;
  badge: string;
  badgeColor: string;
  trigger: { event: string; path?: string; matchValue?: unknown };
}

export function TooltipNotes() {
  const [tooltips, setTooltips] = useState<TooltipEntry[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch('/demo/tooltips.json')
      .then((r) => r.json())
      .then(setTooltips)
      .catch(() => {});
  }, []);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const expandAll = () => setExpanded(new Set(tooltips.map((t) => t.id)));
  const collapseAll = () => setExpanded(new Set());

  return (
    <div
      className="min-h-screen font-mono"
      style={{ background: '#040406', color: '#e8e4dc' }}
    >
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="mb-10">
          <h1
            className="font-display-warm text-[2rem] mb-2"
            style={{ color: 'var(--color-warm-accent, #daa850)' }}
          >
            Presentation Notes
          </h1>
          <div className="flex items-center gap-4">
            <p className="text-[0.85rem]" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {tooltips.length} tooltips · ?demo to present
            </p>
            <div className="flex gap-2">
              <button
                onClick={expandAll}
                className="text-[0.7rem] uppercase tracking-widest px-2.5 py-1 rounded-md cursor-pointer"
                style={{ color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                Expand all
              </button>
              <button
                onClick={collapseAll}
                className="text-[0.7rem] uppercase tracking-widest px-2.5 py-1 rounded-md cursor-pointer"
                style={{ color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                Collapse all
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {tooltips.map((t, i) => {
            const isOpen = expanded.has(t.id);
            return (
              <div
                key={t.id}
                className="glass-panel rounded-xl cursor-pointer transition-all"
                style={{
                  background: isOpen ? 'rgba(12, 12, 24, 0.8)' : 'rgba(12, 12, 24, 0.5)',
                  border: `1px solid ${isOpen ? `${t.badgeColor}22` : 'rgba(255,255,255,0.04)'}`,
                  padding: isOpen ? '20px 24px' : '12px 24px',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                onClick={() => toggle(t.id)}
              >
                {/* Top accent — visible when expanded */}
                {isOpen && (
                  <div
                    className="absolute inset-x-0 top-0 h-px"
                    style={{
                      background: `linear-gradient(90deg, transparent 15%, ${t.badgeColor}60 50%, transparent 85%)`,
                    }}
                  />
                )}

                {/* Collapsed: single row */}
                <div className="flex items-center gap-3">
                  <span
                    className="text-[0.6rem] uppercase tracking-[0.18em] font-bold shrink-0"
                    style={{
                      color: t.badgeColor,
                      padding: '2px 8px',
                      background: `${t.badgeColor}12`,
                      borderRadius: 5,
                      border: `1px solid ${t.badgeColor}25`,
                    }}
                  >
                    {t.badge}
                  </span>
                  <span className="text-[0.95rem] font-semibold flex-1" style={{ color: '#e8e4dc' }}>
                    {t.title}
                  </span>
                  <span className="text-[0.6rem] tabular-nums shrink-0" style={{ color: 'rgba(255,255,255,0.15)' }}>
                    {i + 1}/{tooltips.length}
                  </span>
                  <span
                    className="text-[0.7rem] shrink-0 transition-transform"
                    style={{ color: 'rgba(255,255,255,0.2)', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
                  >
                    ›
                  </span>
                </div>

                {/* Expanded content */}
                {isOpen && (
                  <div className="mt-3">
                    {/* Trigger */}
                    <div className="mb-3">
                      <span className="text-[0.55rem] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.12)' }}>
                        {t.trigger.path || t.trigger.event}
                        {t.trigger.matchValue !== undefined && ` = ${t.trigger.matchValue}`}
                      </span>
                    </div>

                    {/* Keywords */}
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {t.body.split(' · ').map((item, j) => (
                        <span
                          key={j}
                          className="text-[0.75rem] px-2 py-0.5 rounded-md"
                          style={{
                            color: '#c0bbb0',
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.06)',
                          }}
                        >
                          {item.trim()}
                        </span>
                      ))}
                    </div>

                    {/* Detail */}
                    {t.detail && (
                      <p className="text-[0.78rem] leading-relaxed" style={{ color: 'rgba(255,255,255,0.32)' }}>
                        {t.detail}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
