import Slide from '@/components/Slide';
import type { SlideProps } from './types';

export const meta = {
  id: '35-credits',
  number: 35,
  chapter: 'Close',
  title: 'Créditos',
  tint: 'cream' as const,
  notes: `Línea cruda: "Gracias a los que aguantaron el refactor, a los que vinieron a verlo fallar antes que nadie, y a la comunidad de ADK y SDK que no cobra."
Punchline no escrito: "Los bugs, como siempre, son míos."
Pregunta probable: "¿Va a haber writeups?" → "Sí, uno por scope. Los linkeo desde el repo cuando abra."`,
};

const blocks = [
  {
    t: 'RUNTIMES',
    items: ['Google Agent Developer Kit (ADK)', 'Claude Agent SDK', 'AG-UI protocol'],
    tint: 'gold',
  },
  {
    t: 'IDE',
    items: ['Claude Code', 'Claude Mermaid plugin', 'Context7 plugin', 'Playwright skill'],
    tint: 'cyan',
  },
  {
    t: 'GENTE',
    items: ['Pili — rescate del tile-classifier', 'Testers tempranos que no se rieron', 'Maintainers de ADK + SDK'],
    tint: 'magenta',
  },
  {
    t: 'HERRAMIENTAS EN PANTALLA',
    items: ['Next.js · React · Tailwind', 'Mermaid · svg-pan-zoom · Shiki', 'Press Start 2P · VT323 · JetBrains Mono'],
    tint: 'moss',
  },
];

export default function Slide35({}: SlideProps) {
  return (
    <Slide tint="cream" chapter="Close" title="Créditos">
      <div className="grid grid-cols-4 gap-4 h-full">
        {blocks.map((b, i) => (
          <div key={b.t} className={`dialog-box p-4 tint-${b.tint} animate-rise`} style={{ animationDelay: `${i * 80}ms` }}>
            <span className="pip-bl" /><span className="pip-br" />
            <div className="tint-bar -mx-4 -mt-4 mb-3" />
            <div className="font-pixel text-[11px] opacity-80">{b.t}</div>
            <ul className="mt-3 space-y-2 text-[15px]">
              {b.items.map((x) => (
                <li key={x}>· {x}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-6 text-cream/70 text-[15px] italic">
        "Los agentes son sólo un loop" — sí, pero la decoración es lo interesante.
      </div>
    </Slide>
  );
}
