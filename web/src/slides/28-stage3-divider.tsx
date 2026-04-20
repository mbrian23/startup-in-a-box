import type { SlideProps } from './types';

export const meta = {
  id: '28-stage3-divider',
  number: 28,
  chapter: 'Etapa 3 · Final Level',
  title: 'Final level — atando todo con alambre',
  tint: 'gold' as const,
  notes: `Línea cruda: "Stage final. ¿Cómo hablan los dos runtimes? ¿Quién le avisa al humano? ¿Cómo se ve todo en un solo frontend?"
Punchline no escrito: "Si todo sale bien, en siete minutos vemos código propio corriendo."
Pregunta probable: "¿Esto es el demo?" → "No. Esto es el cuarto donde pasa el demo."`,
};

export default function Slide28({}: SlideProps) {
  return (
    <section className="w-full h-full flex items-center justify-center tint-gold animate-crtOn">
      <div className="text-center">
        <div className="font-pixel text-[12px] tracking-[0.35em] opacity-70">ETAPA 03 / 03</div>
        <h1 className="font-display text-[clamp(40px,6vw,84px)] mt-6 text-cream">FINAL LEVEL</h1>
        <div className="mt-6 text-cream/80 text-xl">demo stack · handoff · HITL · AG-UI · demo en vivo · lecciones</div>
        <div className="mt-12 w-[360px] h-[10px] mx-auto" style={{ background: 'var(--tint)' }} />
      </div>
    </section>
  );
}
