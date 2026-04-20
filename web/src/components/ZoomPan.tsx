'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Props = {
  children: React.ReactNode;
  /** Reset trigger — change this (e.g. slide id) to auto-reset pan/zoom. */
  resetKey: string | number;
};

const MIN = 1;
const MAX = 4;

// Lightweight zoom + pan wrapper for slide content.
// - `Ctrl`/`Cmd` + wheel → zoom toward cursor
// - `+` / `=` → zoom in · `-` → zoom out · `0` → reset
// - When zoomed (scale > 1), left-drag pans
// - Resets whenever `resetKey` changes (usually the slide id)
// Buttons/links still work — we only start a pan on an empty background click.
export default function ZoomPan({ children, resetKey }: Props) {
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);

  // Reset when the slide changes.
  useEffect(() => {
    setScale(1);
    setTx(0);
    setTy(0);
  }, [resetKey]);

  // Keep pan bounded so you can't fling content off screen.
  const clamp = useCallback((x: number, y: number, s: number) => {
    const el = rootRef.current;
    if (!el) return { x, y };
    const r = el.getBoundingClientRect();
    const overflowX = (r.width * (s - 1)) / 2;
    const overflowY = (r.height * (s - 1)) / 2;
    return {
      x: Math.max(-overflowX, Math.min(overflowX, x)),
      y: Math.max(-overflowY, Math.min(overflowY, y)),
    };
  }, []);

  // Wheel zoom (only with Ctrl/Cmd, else let the page scroll).
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const delta = -e.deltaY * 0.0025;
      const next = Math.max(MIN, Math.min(MAX, scale * (1 + delta)));
      // Zoom toward cursor
      const r = el.getBoundingClientRect();
      const cx = e.clientX - r.left - r.width / 2;
      const cy = e.clientY - r.top - r.height / 2;
      const k = next / scale;
      const nx = cx - k * (cx - tx);
      const ny = cy - k * (cy - ty);
      const cl = clamp(nx, ny, next);
      setScale(next);
      setTx(cl.x);
      setTy(cl.y);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [scale, tx, ty, clamp]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        setScale((s) => Math.min(MAX, s * 1.2));
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        setScale((s) => {
          const n = Math.max(MIN, s / 1.2);
          if (n === 1) {
            setTx(0);
            setTy(0);
          }
          return n;
        });
      } else if (e.key === '0') {
        setScale(1);
        setTx(0);
        setTy(0);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Drag to pan — but only when zoomed and dragging from a non-interactive target.
  const onPointerDown = (e: React.PointerEvent) => {
    if (scale <= 1.01) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, textarea, select')) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragStart.current = { x: e.clientX, y: e.clientY, tx, ty };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragStart.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    const cl = clamp(dragStart.current.tx + dx, dragStart.current.ty + dy, scale);
    setTx(cl.x);
    setTy(cl.y);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (dragStart.current) {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      dragStart.current = null;
    }
  };

  const zoomed = scale > 1.01;

  return (
    <div
      ref={rootRef}
      className="absolute inset-0 overflow-hidden"
      style={{ cursor: zoomed ? (dragStart.current ? 'grabbing' : 'grab') : 'default' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className="absolute inset-0"
        style={{
          transform: `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`,
          transformOrigin: 'center center',
          transition: dragStart.current ? 'none' : 'transform 120ms ease-out',
          willChange: 'transform',
        }}
      >
        {children}
      </div>
      {zoomed && (
        <div className="absolute top-14 right-6 z-40 chapter-chip pointer-events-none" style={{ background: 'rgba(18, 28, 56, 0.88)' }}>
          <span className="dot" />
          <span>{scale.toFixed(1)}×</span>
          <span className="ml-2 text-cream/70">0 = RESET</span>
        </div>
      )}
    </div>
  );
}
