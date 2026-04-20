import Slide from '@/components/Slide';
import HookSimulator from '@/components/HookSimulator';
import type { SlideProps } from './types';

export const meta = {
  id: '25-hooks',
  number: 25,
  chapter: 'Scope C · Claude Agent SDK',
  title: 'Hooks — denegar con razón',
  tint: 'magenta' as const,
  notes: `Línea cruda: "Los hooks son el lugar donde el agente se entera de por qué no puede hacer algo. Devuelven allow o deny, y el deny viene con razón. Esa razón entra al contexto del próximo turno."
Punchline no escrito: "Es el único feedback loop honesto que tenés con tu agente."
Pregunta probable: "¿El agente aprende de la razón?" → "Re-planifica. No 'aprende' entre runs, pero sí dentro del mismo run."`,
};

export default function Slide25({}: SlideProps) {
  return (
    <Slide tint="magenta" chapter="Scope C · Claude Agent SDK" title="Hooks — denegar con razón">
      <div className="grid grid-cols-[1fr_1.1fr] gap-6">
        <div className="space-y-4 text-cream/95 text-[18px]">
          <p>El único feedback loop honesto con tu agente.</p>
          <ul className="list-disc pl-5 space-y-2">
            <li><b>deny-rm-rf</b></li>
            <li><b>deny-net-egress</b> fuera del allowlist</li>
            <li><b>deny-secret-shaped-strings</b> (<code>sk_live_</code>)</li>
            <li><b>deny-no-verify</b></li>
            <li><b>compress-on-long-read</b> — 200KB a 4KB</li>
          </ul>
          <p className="text-cream/80 text-[16px]">
            Probá el simulador →
          </p>
        </div>
        <HookSimulator />
      </div>
    </Slide>
  );
}
