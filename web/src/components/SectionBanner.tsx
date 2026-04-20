'use client';

import { motion, AnimatePresence } from 'motion/react';
import type { Tint } from '@/lib/palette';

type Props = { chapter: string; tint: Tint; slideNumber: number; slideTotal: number };

// A persistent, section-color-coded banner that sits on top of the deck and
// doesn't re-animate on every slide inside the same chapter — only when the
// chapter changes. That's the whole point: from across the room, the colour
// tells you where in the talk we are.
export default function SectionBanner({ chapter, tint, slideNumber, slideTotal }: Props) {
  return (
    <div className={`pointer-events-none tint-${tint}`}>
      {/* Left-edge ribbon — always on, full height, animates colour on chapter change */}
      <motion.div
        aria-hidden
        className="absolute left-0 top-0 bottom-[44px] w-[8px] z-30"
        initial={false}
        animate={{ backgroundColor: 'var(--tint)' }}
        transition={{ duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }}
        style={{
          boxShadow: '10px 0 32px -8px color-mix(in srgb, var(--tint) 60%, transparent)',
        }}
      />

      {/* Top-edge accent glow */}
      <motion.div
        aria-hidden
        className="absolute top-0 left-0 right-0 h-[3px] z-30"
        initial={false}
        animate={{ backgroundColor: 'var(--tint)' }}
        transition={{ duration: 0.6 }}
        style={{
          boxShadow: '0 6px 24px -4px color-mix(in srgb, var(--tint) 55%, transparent)',
        }}
      />

      {/* Floating chapter badge — top right */}
      <AnimatePresence mode="wait">
        <motion.div
          key={chapter}
          initial={{ opacity: 0, x: 12, filter: 'blur(6px)' }}
          animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, x: 8, filter: 'blur(4px)' }}
          transition={{ duration: 0.35 }}
          className="absolute top-5 right-6 z-30 chapter-chip"
        >
          <span className="dot" />
          <span className="tracking-[0.22em]">{chapter.toUpperCase()}</span>
          <span className="ml-2 text-cream/70">
            {String(slideNumber).padStart(2, '0')}/{String(slideTotal).padStart(2, '0')}
          </span>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
