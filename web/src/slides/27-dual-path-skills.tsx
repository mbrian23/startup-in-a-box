import Slide from '@/components/Slide';
import type { SlideProps } from './types';

export const meta = {
  id: '27-dual-path-skills',
  number: 27,
  chapter: 'Scope C · Claude Agent SDK',
  title: 'Skills de doble vía — mock o real',
  tint: 'magenta' as const,
  notes: `Línea cruda: "Todas las skills que tocan servicios externos tienen dos caminos: si falta la API key, devuelven un mock determinístico; si la tienen, hacen la llamada real. El camino que corre es evidente por el log."
Punchline no escrito: "Así un demo en vivo no te llama 47 dólares de Stripe."
Pregunta probable: "¿Cómo probás el camino real?" → "Un smoke test nightly con keys de test. El camino mock lo ves en todos los PRs."`,
};

export default function Slide27({}: SlideProps) {
  return (
    <Slide tint="magenta" chapter="Scope C · Claude Agent SDK" title="Skills de doble vía — mock o real">
      <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-6">
        <div className="dialog-box p-5">
          <span className="pip-bl" /><span className="pip-br" />
          <div className="font-pixel text-[11px] text-magenta mb-3">factory/skills/stripe-checkout.py</div>
          <pre className="font-mono text-[14px] leading-relaxed whitespace-pre-wrap">
{`def create_checkout(plan: PriceSpec) -> CheckoutSession:
    key = os.environ.get("STRIPE_SECRET_KEY")
    if not key:
        log.warning("stripe: no STRIPE_SECRET_KEY — mocking")
        return CheckoutSession(
            id=f"cs_mock_{plan.id}",
            url=f"https://mock/checkout/{plan.id}",
            mode="mock",
        )
    return stripe_client(key).Checkout.Session.create(...)`}
          </pre>
        </div>
        <div className="space-y-4 text-cream/95 text-[18px]">
          <p>Mock o real — el log te lo dice.</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>sin key → mock determinístico</li>
            <li>con key → llamada real, loggeada</li>
            <li><code>mode</code> visible en cada evento</li>
          </ul>
          <p className="text-cream/80 text-[16px]">
            Falso pero verosímil le gana a ausente.
          </p>
        </div>
      </div>
    </Slide>
  );
}
