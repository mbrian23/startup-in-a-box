'use client';

import { motion, AnimatePresence } from 'motion/react';
import type { Tint } from '@/lib/palette';

type Props = {
  index: number;
  total: number;
  title: string;
  tint: Tint;
  sseOpen: boolean;
};

export default function StatusBar({ index, total, title, tint, sseOpen }: Props) {
  return (
    <div
      className={`tint-${tint} absolute bottom-0 left-0 right-0 grid grid-cols-[1fr_auto_1fr] items-center px-6 py-2 border-t-2 border-greyline bg-dialog2/85 backdrop-blur-sm text-cream font-pixel text-[13px] z-40`}
      style={{ height: 44 }}
    >
      <span className="flex items-center gap-2 justify-self-start">
        <span
          className="inline-block w-3 h-3"
          style={{
            background: 'var(--tint)',
            boxShadow: '0 0 10px color-mix(in srgb, var(--tint) 80%, transparent)',
          }}
        />
        MARTIN BRIAN
      </span>

      <AnimatePresence mode="wait">
        <motion.div
          key={title}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 0.92, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.28 }}
          className="truncate max-w-[60vw] text-cream justify-self-center text-center"
        >
          {title}
        </motion.div>
      </AnimatePresence>

      <div className="flex items-center gap-5 justify-self-end">
        {sseOpen && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-cyan"
          >
            SSE ◉
          </motion.span>
        )}
        <span className="text-cream">
          {String(index + 1).padStart(2, '0')} <span className="opacity-60">/</span>{' '}
          {String(total).padStart(2, '0')}
        </span>
      </div>
    </div>
  );
}
