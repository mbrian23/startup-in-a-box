'use client';

import { motion } from 'motion/react';
import type { SlideProps } from './types';

export const meta = {
  id: '21-scopeC-divider',
  number: 21,
  chapter: 'Scope C · Claude Agent SDK',
  title: 'Scope C — patrones del Claude Agent SDK',
  tint: 'magenta' as const,
  notes: `Línea cruda: "Scope C: la fábrica. Claude Agent SDK. Un supervisor que delega, cinco subagents especializados, y un sandbox que no te deja borrarte el disco."
Punchline no escrito: "Si ADK es la reunión, esto es el pasillo con la herramienta eléctrica."
Pregunta probable: "¿Por qué dos frameworks y no uno?" → "Porque escribir código con ADK es como hornear con una cuchara."`,
};

export default function Slide21({}: SlideProps) {
  return (
    <section className="w-full h-full flex items-center justify-center tint-magenta">
      <div className="text-center">
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="font-pixel text-[13px] tracking-[0.4em] text-cream/75"
        >
          SCOPE C / C
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, scale: 0.94, filter: 'blur(10px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          transition={{ delay: 0.15, duration: 0.7 }}
          className="font-display text-[clamp(52px,7vw,104px)] mt-6 text-cream glow-text"
        >
          CLAUDE AGENT SDK
        </motion.h1>
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 0.5 }}
          className="mt-7 text-cream text-[clamp(20px,2vw,26px)]"
        >
          el runtime de la fábrica
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
