'use client';

import Slide from '@/components/Slide';
import DemoIframe from '@/components/DemoIframe';
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

export default function Slide33({ ctx }: SlideProps) {
  return (
    <Slide tint="gold" chapter="Etapa 3 · Final Level" title="Demo en vivo — apretá D para pantalla completa">
      <DemoIframe ctx={ctx} url="http://localhost:3000" />
    </Slide>
  );
}
