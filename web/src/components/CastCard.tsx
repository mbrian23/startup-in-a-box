'use client';

import { motion } from 'motion/react';
import clsx from '@/lib/clsx';
import type { Tint } from '@/lib/palette';

type Props = {
  codename: string;
  role: string;
  deliverable: string;
  quote: string;
  tint?: Tint;
  index?: number;
};

export default function CastCard({ codename, role, deliverable, quote, tint = 'gold', index = 0 }: Props) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 16, filter: 'blur(6px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.45, delay: index * 0.06, ease: [0.2, 0.7, 0.2, 1] }}
      whileHover={{ y: -3 }}
      className={clsx('dialog-box p-4', `tint-${tint}`)}
    >
      <span className="pip-bl" />
      <span className="pip-br" />
      <div className="tint-bar mb-3 -mx-4 -mt-4" />
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-[19px] text-cream glow-text">{codename}</h3>
        <span className="font-pixel text-[11px] text-cream/75 tracking-wider">{role}</span>
      </div>
      <div className="mt-3 text-[17px] leading-snug text-cream/95">{deliverable}</div>
      <div
        className="mt-4 text-[15px] text-cream/85 italic border-l-[3px] pl-3 leading-relaxed"
        style={{ borderColor: 'var(--tint)' }}
      >
        “{quote}”
      </div>
    </motion.article>
  );
}
