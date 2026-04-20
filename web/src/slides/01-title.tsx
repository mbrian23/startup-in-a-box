'use client';

import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import type { SlideProps } from './types';

export const meta = {
  id: '01-title',
  number: 1,
  chapter: 'Intro',
  title: 'Startup in a Box',
  tint: 'cream' as const,
  notes: `Línea cruda: "Bienvenidos. En los próximos cuarenta minutos, dos runtimes de agentes van a armar una startup mientras los vemos."
Punchline no escrito: "Si sale mal, también lo vamos a ver. No hay red."
Pregunta probable: "¿Es un demo en vivo?" → "Sí. La deck es el demo."`,
};

const FULL = 'cómo Google ADK y el Claude Agent SDK, cableados juntos, arman una startup mientras la mirás.';

export default function Slide({}: SlideProps) {
  const [typed, setTyped] = useState('');
  useEffect(() => {
    let i = 0;
    const t = setInterval(() => {
      i += 1;
      setTyped(FULL.slice(0, i));
      if (i >= FULL.length) clearInterval(t);
    }, 22);
    return () => clearInterval(t);
  }, []);

  return (
    <section className="w-full flex flex-col items-center justify-center text-center tint-cream">
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.6 }}
        className="font-pixel text-[14px] tracking-[0.35em] text-cream/80"
      >
        2026 · EDICIÓN WEB
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, scale: 0.92, filter: 'blur(12px)' }}
        animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
        transition={{ delay: 0.25, duration: 0.8, ease: [0.2, 0.7, 0.2, 1] }}
        className="font-display text-[clamp(48px,7vw,104px)] leading-[1.05] mt-8 glow-text text-cream"
      >
        STARTUP
        <br />
        <span className="text-gold">IN A BOX</span>
      </motion.h1>

      <div className="mt-12 max-w-[900px] text-cream text-[clamp(20px,2vw,26px)] leading-relaxed min-h-[4.5em]">
        {typed}
        {typed.length < FULL.length && <span className="caret" />}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.6, duration: 0.8 }}
        className="mt-16 font-pixel text-[14px] tracking-[0.3em] text-cream/75 caret"
      >
        APRETÁ F PARA PANTALLA COMPLETA · → PARA EMPEZAR
      </motion.div>
    </section>
  );
}
