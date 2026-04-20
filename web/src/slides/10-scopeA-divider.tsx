'use client';

import { motion } from 'motion/react';
import type { SlideProps } from './types';

export const meta = {
  id: '10-scopeA-divider',
  number: 10,
  chapter: 'Scope A · Claude Code',
  title: 'Scope A — Claude Code como dev env',
  tint: 'cyan' as const,
  notes: `Línea cruda: "Scope A: cómo trabajé. No es un tutorial, son tips de haber usado Claude Code como IDE durante seis semanas."
Punchline no escrito: "Si viniste esperando 'cómo instalarlo', mirá la home del repo."
Pregunta probable: "¿Por qué no usás Cursor?" → "Porque Claude Code se sienta encima de tu shell, no adentro de tu editor. Es una diferencia chica que cambia todo."`,
};

export default function Slide10({}: SlideProps) {
  return (
    <section className="w-full h-full flex items-center justify-center tint-cyan">
      <div className="text-center">
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="font-pixel text-[13px] tracking-[0.4em] text-cream/75"
        >
          SCOPE A / C
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, scale: 0.94, filter: 'blur(10px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          transition={{ delay: 0.15, duration: 0.7 }}
          className="font-display text-[clamp(52px,7vw,104px)] mt-6 text-cream glow-text"
        >
          CLAUDE CODE
        </motion.h1>
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 0.5 }}
          className="mt-7 text-cream text-[clamp(20px,2vw,26px)]"
        >
          el IDE al que podés delegar
        </motion.div>
        <motion.div
          initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.7, duration: 0.6 }}
          className="mt-14 w-[420px] h-[10px] mx-auto origin-center"
          style={{ background: 'var(--tint)', boxShadow: '0 0 24px color-mix(in srgb, var(--tint) 70%, transparent)' }}
        />
      </div>
    </section>
  );
}
