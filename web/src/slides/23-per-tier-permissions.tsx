import Slide from '@/components/Slide';
import type { SlideProps } from './types';

export const meta = {
  id: '23-per-tier-permissions',
  number: 23,
  chapter: 'Scope C · Claude Agent SDK',
  title: 'Permisos por tier',
  tint: 'magenta' as const,
  notes: `Línea cruda: "Cada subagent tiene un tier de permisos: qué herramientas puede usar y qué caminos del filesystem puede tocar. No confiás en un subagent de tests con acceso a deploy."
Punchline no escrito: "Least privilege, pero con onda."
Pregunta probable: "¿Y si un subagent necesita más?" → "Lo escalás con un mensaje al supervisor; el supervisor decide. No hay auto-upgrade."`,
};

const tiers = [
  { name: 'read-only', tools: ['Read', 'Grep', 'Glob'], write: '—', shell: '—', sub: 'build_reviewer' },
  { name: 'write', tools: ['Read', 'Write', 'Glob', 'Grep'], write: 'workspace/**', shell: '—', sub: 'architect' },
  { name: 'write+shell', tools: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash'], write: 'workspace/**', shell: 'npm, tsc, git (con hooks)', sub: 'implementer' },
  { name: 'shell-only', tools: ['Read', 'Grep', 'Glob', 'Bash'], write: '—', shell: 'tsc --noEmit, build, lint', sub: 'tester' },
  { name: 'deploy', tools: ['Read', 'Write', 'Edit', 'Bash'], write: 'workspace/**', shell: 'gh, vercel --token (no login)', sub: 'devops' },
];

export default function Slide23({}: SlideProps) {
  return (
    <Slide tint="magenta" chapter="Scope C · Claude Agent SDK" title="Permisos por tier">
      <table className="w-full border-collapse font-mono text-[16px]">
        <thead>
          <tr className="font-pixel text-[11px] text-cream/85">
            <th className="text-left p-3 border-b-2 border-greyline">tier</th>
            <th className="text-left p-3 border-b-2 border-greyline">tools permitidas</th>
            <th className="text-left p-3 border-b-2 border-greyline">rutas de escritura</th>
            <th className="text-left p-3 border-b-2 border-greyline">patrones de shell</th>
            <th className="text-left p-3 border-b-2 border-greyline">subagents</th>
          </tr>
        </thead>
        <tbody>
          {tiers.map((t, i) => (
            <tr key={t.name} className={`text-cream/95 ${i % 2 ? 'bg-dialog/40' : ''}`}>
              <td className="p-3 align-top">
                <span className="font-pixel text-[12px] text-gold">{t.name}</span>
              </td>
              <td className="p-3 align-top">{t.tools.join(', ')}</td>
              <td className="p-3 align-top">{t.write}</td>
              <td className="p-3 align-top">{t.shell}</td>
              <td className="p-3 align-top">{t.sub}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-6 text-cream/95 text-[18px] max-w-[95ch]">
        Least privilege, pero con onda.
      </div>
    </Slide>
  );
}
