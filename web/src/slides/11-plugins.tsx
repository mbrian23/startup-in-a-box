import Slide from '@/components/Slide';
import type { SlideProps } from './types';

export const meta = {
  id: '11-plugins',
  number: 11,
  chapter: 'Scope A · Claude Code',
  title: 'Plugins que se ganaron el lugar',
  tint: 'cyan' as const,
  notes: `Línea cruda: "De veinte plugins que probé, estos cinco quedaron. El resto se fue al silencio."
Punchline no escrito: "El plugin que te promete 10x productividad, en general, te promete 10x diffs."
Pregunta probable: "¿Algún plugin propio?" → "Todavía no. Lo más cercano son skills — lo vemos en el próximo slide."`,
};

const plugins = [
  { name: 'claude-mermaid', why: 'diagramas con reload en vivo', keeper: 'yes' },
  { name: 'context7', why: 'docs frescas, menos alucinaciones', keeper: 'yes' },
  { name: 'playwright-skill', why: 'browser + screenshots', keeper: 'yes' },
  { name: 'commit-commands', why: '/commit con HEREDOC limpio', keeper: 'yes' },
  { name: 'hookify', why: 'frustración → hook en un paso', keeper: 'yes' },
  { name: 'frontend-design', why: 'pair-designer cuando no sé qué poner', keeper: 'conditional' },
];

export default function Slide11({}: SlideProps) {
  return (
    <Slide tint="cyan" chapter="Scope A · Claude Code" title="Plugins que se ganaron el lugar">
      <div className="grid grid-cols-2 gap-4">
        {plugins.map((p) => (
          <div key={p.name} className="dialog-box p-5 tint-cyan">
            <span className="pip-bl" /><span className="pip-br" />
            <div className="flex items-center justify-between">
              <span className="font-pixel text-[15px] text-cream">{p.name}</span>
              <span
                className={`font-pixel text-[11px] tracking-wider ${p.keeper === 'yes' ? 'text-moss' : 'text-orange'}`}
              >
                {p.keeper === 'yes' ? '● SE QUEDA' : '◌ SITUACIONAL'}
              </span>
            </div>
            <div className="mt-3 text-cream/95 text-[17px] leading-snug">{p.why}</div>
          </div>
        ))}
      </div>
      <div className="mt-7 text-cream/95 text-[20px] leading-relaxed max-w-[100ch]">
        Si no cambia tu commit o tu diff, no lo vas a extrañar.
      </div>
    </Slide>
  );
}
