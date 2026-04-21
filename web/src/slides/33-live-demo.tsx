import Slide from '@/components/Slide';
import type { SlideProps } from './types';

export const meta = {
  id: '33-live-demo',
  number: 33,
  chapter: 'Etapa 3 · Final Level',
  title: 'Demo en vivo',
  tint: 'gold' as const,
  notes: `Línea cruda: "Este slide es el frontend corriendo en 3000, embebido. Apretá D para pantalla completa. Si el stack no está arriba, muestra el fallback."
Punchline no escrito: "Si ves un cartel rojo es porque me olvidé de 'make dev'."
Pregunta probable: "¿Me podés mostrar el post-mortem en vivo?" → "Sí, con '/dev-auto-loop' disparamos una idea y vemos todo el pipeline."`,
};

const DEMO_URL = 'https://startupinabox.martinbrian.com';

export default function Slide33({}: SlideProps) {
  return (
    <Slide tint="gold" chapter="Etapa 3 · Final Level" title="Demo en vivo">
      <div className="flex flex-col items-center justify-center h-[60vh] gap-8">
        <p className="text-cream/90 text-[20px] max-w-[60ch] text-center leading-relaxed">
          La demo reproduce un run pre-grabado del pipeline completo:
          boardroom → factory → deploy.
        </p>
        <a
          href={DEMO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-pixel !text-[16px] !px-8 !py-4"
        >
          ABRIR DEMO ↗
        </a>
        <span className="font-pixel text-[11px] text-cream/50">{DEMO_URL}</span>
      </div>
    </Slide>
  );
}
