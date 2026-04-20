import Slide from '@/components/Slide';
import CodeView from '@/components/CodeView';
import type { SlideProps } from './types';

export const meta = {
  id: '12-skills',
  number: 12,
  chapter: 'Scope A · Claude Code',
  title: 'Skills — el contrato del SKILL.md',
  tint: 'cyan' as const,
  notes: `Línea cruda: "Un skill es un markdown con frontmatter que Claude activa cuando detecta el trigger. Es la forma más barata de empaquetar experiencia."
Punchline no escrito: "Es como un prompt pero con self-esteem."
Pregunta probable: "¿Skill vs comando?" → "Comando lo invocás vos con /algo. Skill se dispara solo cuando la descripción matchea lo que estás haciendo."`,
};

export default function Slide12({}: SlideProps) {
  return (
    <Slide tint="cyan" chapter="Scope A · Claude Code" title="Skills — el contrato del SKILL.md">
      <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-6 h-full">
        <div className="space-y-5 text-[20px] text-cream leading-relaxed">
          <p>Un skill es un prompt con self-esteem.</p>
          <ul className="list-disc pl-5 space-y-2">
            <li><b>skill:</b> conocimiento que sobrevive a la sesión</li>
            <li><b>comando:</b> una acción que retipeás siempre</li>
            <li><b>ninguno:</b> una línea en el README alcanza</li>
          </ul>
          <p className="text-cream/80 text-[17px]">
            Existen porque me cansé de re-explicar lo mismo.
          </p>
        </div>
        <div>
          <CodeView
            path=".claude/skills/dev-auto-loop/SKILL.md"
            language="markdown"
            maxLines={22}
            caption="uno de los 10 skills de este repo"
          />
        </div>
      </div>
    </Slide>
  );
}
