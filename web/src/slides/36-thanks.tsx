import QrCode from '@/components/QrCode';
import type { SlideProps } from './types';

export const meta = {
  id: '36-thanks',
  number: 36,
  chapter: 'Close',
  title: 'Gracias',
  tint: 'cream' as const,
  notes: `Línea cruda: "El QR te lleva a LinkedIn. El repo está abierto. Gracias por aguantar 40 minutos sin parpadear."
Punchline no escrito: "Ahora sí, preguntas."
Pregunta probable: "¿Dónde sigo esto?" → "LinkedIn o directamente en el repo."`,
};

export default function Slide36({}: SlideProps) {
  return (
    <section className="w-full h-full flex flex-col items-center justify-center text-center animate-crtOn tint-cream">
      <div className="font-pixel text-[12px] tracking-[0.35em] opacity-70">FIN</div>
      <h1 className="font-display text-[clamp(48px,6vw,96px)] mt-6 text-cream">
        GRACIAS
      </h1>
      <div className="mt-6 text-cream/80 text-xl max-w-[56ch]">
        Repo <span className="text-orange">abierto</span> — MIT.
      </div>
      <div className="mt-10 flex items-start gap-12">
        <QrCode url="https://www.linkedin.com/in/martinbrianmdbn/" size={220} label="linkedin · pingueame" />
        <div className="text-left space-y-2 font-mono text-[15px] pt-3">
          <div><span className="opacity-60 font-pixel text-[11px]">LINKEDIN</span><br />linkedin.com/in/martinbrianmdbn</div>
          <div><span className="opacity-60 font-pixel text-[11px]">REPO</span><br />github.com/mbrian23/startup-in-a-box</div>
          <div className="pt-2 opacity-70">preguntas?</div>
        </div>
      </div>
    </section>
  );
}
