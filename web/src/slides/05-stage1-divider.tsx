'use client';

import { motion } from 'motion/react';
import type { SlideProps } from './types';

export const meta = {
  id: '05-stage1-divider',
  number: 5,
  chapter: 'Etapa 1 · Setup',
  title: 'Etapa 1 — El Setup',
  tint: 'moss' as const,
  notes: `Línea cruda: "Antes de mostrar cómo se arman dos runtimes, diez minutos de fundamentos para que nadie se pierda."
Punchline no escrito: "Si ya sabés qué es un tool-call, podés pestañear, vuelvo en el slide 10."
Pregunta probable: "¿Esto es tutorial?" → "No. Es el piso mínimo. No va a haber '¿qué es un LLM?'."`,
};

export default function Slide05({}: SlideProps) {
  return (
    <section className="w-full h-full flex items-center justify-center tint-moss">
      <div className="text-center">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="font-pixel text-[13px] tracking-[0.4em] text-cream/75"
        >
          ETAPA 01 / 03
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, scale: 0.94, filter: 'blur(10px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          transition={{ delay: 0.15, duration: 0.7 }}
          className="font-display text-[clamp(52px,7vw,104px)] mt-6 text-cream glow-text"
        >
          EL SETUP
        </motion.h1>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="mt-7 text-cream text-[clamp(20px,2vw,26px)]"
        >
          tools · loops · por qué los agentes dejan de ser un juguete
        </motion.div>
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.7, duration: 0.6, ease: 'easeOut' }}
          className="mt-14 w-[420px] h-[10px] mx-auto origin-center"
          style={{ background: 'var(--tint)', boxShadow: '0 0 24px color-mix(in srgb, var(--tint) 70%, transparent)' }}
        />
      </div>
    </section>
  );
}
