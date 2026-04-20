import Slide from '@/components/Slide';
import CodeView from '@/components/CodeView';
import type { SlideProps } from './types';

export const meta = {
  id: '13-config',
  number: 13,
  chapter: 'Scope A · Claude Code',
  title: 'Config — settings.json y hooks',
  tint: 'cyan' as const,
  notes: `Línea cruda: "settings.json no es un archivo de configuración: es un acuerdo con tu yo del futuro. Hooks son el único mecanismo que no podés ignorar porque corren antes de cada acción."
Punchline no escrito: "Es el único lugar donde me tomo en serio lo que prometo."
Pregunta probable: "¿Memory no sirve para esto?" → "No. Memory lo podés ignorar. Un hook te bloquea. Son herramientas distintas."`,
};

export default function Slide13({}: SlideProps) {
  return (
    <Slide tint="cyan" chapter="Scope A · Claude Code" title="Config — settings.json y hooks">
      <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1.2fr)] gap-6">
        <div className="space-y-5 text-[20px] text-cream leading-relaxed">
          <p>El único acuerdo que Claude no puede ignorar.</p>
          <ul className="list-disc pl-5 space-y-2">
            <li><b>deny-rm-rf</b> — me salvó una vez</li>
            <li><b>no --no-verify</b> — me salvó dos veces</li>
            <li><b>no secrets en Write</b> — seguro barato</li>
          </ul>
          <p className="text-cream/80 text-[17px]">
            Mové permisos entre máquinas, no hooks.
          </p>
        </div>
        <CodeView
          path=".claude/settings.json"
          language="json"
          maxLines={22}
          caption="la lista de enabledPlugins de este repo"
        />
      </div>
    </Slide>
  );
}
