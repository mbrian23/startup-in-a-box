import Slide from '@/components/Slide';
import type { SlideProps } from './types';

export const meta = {
  id: '24-hermetic-sandbox',
  number: 24,
  chapter: 'Scope C · Claude Agent SDK',
  title: 'Shell y filesystem herméticos',
  tint: 'magenta' as const,
  notes: `Línea cruda: "Hermetic = cada subagent ve un filesystem y una red recortados. Si algo rompe, rompe adentro de la caja; afuera no pasa nada."
Punchline no escrito: "Es sandbox porque una vez me comí mi propio .env en dev."
Pregunta probable: "¿Docker?" → "No hace falta. Con chdir, overlayfs opcional y un allowlist de hosts alcanza para dev."`,
};

const layers = [
  {
    k: 'cwd',
    t: 'Filesystem',
    d: 'chdir a workspace/<run_id>/ — padres invisibles.',
    tint: 'cyan',
  },
  {
    k: 'env',
    t: 'Entorno',
    d: 'allowlist de env vars por tier.',
    tint: 'gold',
  },
  {
    k: 'net',
    t: 'Red',
    d: 'egress: stripe, vercel, localhost. El resto, deny.',
    tint: 'magenta',
  },
  {
    k: 'proc',
    t: 'Procesos',
    d: 'fork/exec pasan por el hook de bash.',
    tint: 'moss',
  },
];

export default function Slide24({}: SlideProps) {
  return (
    <Slide tint="magenta" chapter="Scope C · Claude Agent SDK" title="Shell y filesystem herméticos">
      <div className="grid grid-cols-2 gap-5">
        {layers.map((l, i) => (
          <div key={l.k} className={`dialog-box p-5 tint-${l.tint} animate-rise`} style={{ animationDelay: `${i * 60}ms` }}>
            <span className="pip-bl" /><span className="pip-br" />
            <div className="tint-bar -mx-5 -mt-5 mb-4" />
            <div className="font-pixel text-[11px] text-cream/80">{l.k.toUpperCase()}</div>
            <h3 className="font-display text-lg mt-2 text-cream">{l.t}</h3>
            <p className="mt-3 text-cream/95 text-[18px] leading-snug">{l.d}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 text-cream/95 text-[18px] max-w-[100ch]">
        Si rompe, rompe adentro de la caja.
      </div>
    </Slide>
  );
}
