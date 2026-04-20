'use client';

import { motion } from 'motion/react';
import type { SlideProps } from './types';

export const meta = {
  id: '15-scopeB-divider',
  number: 15,
  chapter: 'Scope B · Google ADK',
  title: 'Scope B — patrones con Google ADK',
  tint: 'gold' as const,
  notes: `Línea cruda: "Scope B: el boardroom. Google ADK. Siete agentes con personalidad, una sesión compartida, y un facilitador que decide quién habla."
Punchline no escrito: "Es Catan pero con LLMs."
Pregunta probable: "¿Por qué ADK y no LangGraph?" → "Sessions + output_schema + sub-agents integrados. LangGraph te obliga a escribir más plomería."`,
};

export default function Slide15({}: SlideProps) {
  return (
    <section className="w-full h-full flex items-center justify-center tint-gold">
      <div className="text-center">
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="font-pixel text-[13px] tracking-[0.4em] text-cream/75"
        >
          SCOPE B / C
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, scale: 0.94, filter: 'blur(10px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          transition={{ delay: 0.15, duration: 0.7 }}
          className="font-display text-[clamp(52px,7vw,104px)] mt-6 text-cream glow-text"
        >
          GOOGLE ADK
        </motion.h1>
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 0.5 }}
          className="mt-7 text-cream text-[clamp(20px,2vw,26px)]"
        >
          el runtime del boardroom
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
