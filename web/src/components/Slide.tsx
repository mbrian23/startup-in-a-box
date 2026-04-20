'use client';

import { motion } from 'motion/react';
import type { Tint } from '@/lib/palette';
import clsx from '@/lib/clsx';

type Props = {
  tint: Tint;
  chapter: string;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  compact?: boolean;
};

// Stagger the header + body + contents for a smooth reveal.
const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
};
const child = {
  hidden: { opacity: 0, y: 14, filter: 'blur(6px)' },
  show: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.42, ease: [0.2, 0.7, 0.2, 1] as [number, number, number, number] },
  },
};

export default function Slide({ tint, chapter, title, subtitle, children, compact }: Props) {
  return (
    <motion.section
      variants={container}
      initial="hidden"
      animate="show"
      className={clsx('w-full max-w-[1600px] flex flex-col', `tint-${tint}`)}
    >
      <motion.div variants={child} className="tint-bar mb-5" />

      <motion.header variants={child} className="flex items-end justify-between mb-6">
        <div>
          <div className="chapter-chip">
            <span className="dot" />
            <span>{chapter.toUpperCase()}</span>
          </div>
          {title && (
            <h1 className="font-display text-[clamp(28px,2.8vw,40px)] leading-[1.15] mt-4 text-cream glow-text">
              {title}
            </h1>
          )}
          {subtitle && (
            <div className="mt-3 text-cream/90 text-[clamp(18px,1.6vw,22px)] leading-relaxed">
              {subtitle}
            </div>
          )}
        </div>
      </motion.header>

      <motion.div
        variants={child}
        className={clsx('flex-1 min-h-0', compact ? 'text-[18px]' : 'text-[20px]')}
      >
        {children}
      </motion.div>
    </motion.section>
  );
}
