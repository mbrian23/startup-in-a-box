import Slide from '@/components/Slide';
import CodeView from '@/components/CodeView';
import type { SlideProps } from './types';

export const meta = {
  id: '22-supervisor-subagents',
  number: 22,
  chapter: 'Scope C · Claude Agent SDK',
  title: 'Supervisor + 5 subagents',
  tint: 'magenta' as const,
  notes: `Línea cruda: "La fábrica es un supervisor más cinco subagents: architect, implementer, tester, devops y build_reviewer. El supervisor no escribe código; delega."
Punchline no escrito: "Es lo más parecido a un tech lead decente que encontré."
Pregunta probable: "¿Cuánto se comparte entre subagents?" → "El filesystem. Nada más. El estado vive en los archivos que van tocando."`,
};

const subs = [
  { name: 'architect', tint: 'cyan', job: 'diseña el layout del proyecto + CLAUDE.md (opus)' },
  { name: 'implementer', tint: 'gold', job: 'escribe el código de la app (sonnet)' },
  { name: 'tester', tint: 'orange', job: 'tsc --noEmit, build, lint (haiku)' },
  { name: 'devops', tint: 'moss', job: 'git → GitHub → Vercel deploy (haiku)' },
  { name: 'build_reviewer', tint: 'lila', job: 'QA final contra CLAUDE.md (sonnet)' },
];

export default function Slide22({}: SlideProps) {
  return (
    <Slide tint="magenta" chapter="Scope C · Claude Agent SDK" title="Supervisor + 5 subagents">
      <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-6">
        <CodeView
          path="factory/src/factory/subagents.py"
          language="python"
          maxLines={22}
          caption="cómo se registran los subagents con el supervisor"
        />
        <div className="space-y-3">
          {subs.map((s, i) => (
            <div key={s.name} className={`dialog-box p-3 tint-${s.tint} animate-rise`} style={{ animationDelay: `${i * 60}ms` }}>
              <span className="pip-bl" /><span className="pip-br" />
              <div className="flex items-center justify-between">
                <span className="font-pixel text-[13px] text-cream">{s.name}</span>
                <span className="w-2 h-2" style={{ background: 'var(--tint)' }} />
              </div>
              <div className="mt-1 text-cream/95 text-[18px]">{s.job}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-5 text-cream/95 text-[18px]">
        El supervisor delega — no escribe código.
      </div>
    </Slide>
  );
}
