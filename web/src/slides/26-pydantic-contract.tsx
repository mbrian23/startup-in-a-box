import Slide from '@/components/Slide';
import type { SlideProps } from './types';

export const meta = {
  id: '26-pydantic-contract',
  number: 26,
  chapter: 'Scope C · Claude Agent SDK',
  title: 'Pydantic como contrato tipado',
  tint: 'magenta' as const,
  notes: `Línea cruda: "El contrato entre runtimes son modelos Pydantic. Si no valida, no avanza. Ni JSON schema libre ni 'confiá en mí'."
Punchline no escrito: "Ingeniería es poner tipos en los bordes."
Pregunta probable: "¿Por qué Pydantic y no dataclasses?" → "Porque Pydantic te da validación y coerción gratis. dataclasses te dejan a la intemperie."`,
};

export default function Slide26({}: SlideProps) {
  return (
    <Slide tint="magenta" chapter="Scope C · Claude Agent SDK" title="Pydantic como contrato tipado">
      <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-6">
        <div className="dialog-box p-5">
          <span className="pip-bl" /><span className="pip-br" />
          <div className="font-pixel text-[11px] text-cream/80 mb-3">el contrato del handoff</div>
          <pre className="font-mono text-[14px] leading-relaxed whitespace-pre">
{`class BuildPlan(BaseModel):
    run_id: str
    pages: list[PageSpec]
    payments: PaymentsSpec | None = None
    env: dict[str, EnvVarSpec] = Field(default_factory=dict)
    model_config = ConfigDict(extra="forbid")

class PageSpec(BaseModel):
    route: str
    title: str
    components: list[ComponentSpec]
    # extra="forbid" en el padre = no sobrevive ningún key con typo`}
          </pre>
          <div className="mt-4 text-cream/95 text-[16px]">
            <code>extra="forbid"</code> — el héroe silencioso.
          </div>
        </div>
        <div className="space-y-4 text-cream/95 text-[18px]">
          <p>Si no valida, no avanza.</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>un schema, dos lenguajes</li>
            <li>fallar rápido, nada a medias</li>
            <li>versionado — <code>V1</code>, <code>V2</code></li>
          </ul>
        </div>
      </div>
    </Slide>
  );
}
