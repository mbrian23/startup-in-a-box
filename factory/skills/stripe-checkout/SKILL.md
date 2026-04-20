---
name: stripe-checkout
description: Use this skill whenever a build step involves pricing, checkout, payments, Stripe, or any `app/checkout/**` or `app/api/checkout/**` path. Defines the dual-path checkout contract for every generated site — a mock flow that works out of the box with zero env vars, and a real Stripe Checkout Session flow that activates automatically when `STRIPE_SECRET_KEY` is present. Covers exact file shapes, the env-var branch, `package.json` updates, `.env.example`, and the README "Going live" section.
---

# Stripe Checkout — Dual Path

Every generated site ships with a checkout flow that:

- **Just works** out of the box with no env vars (mock path).
- **Upgrades to real Stripe** when the repo owner drops test keys into `.env.local` — no code changes required.

The ONLY thing that flips between mock and real is `process.env.STRIPE_SECRET_KEY` on the server. The client always hits `/api/checkout` the same way; the route handler decides.

## File checklist

```
app/
  checkout/
    page.tsx           ← card form; submits to /api/checkout
    success/
      page.tsx         ← confirmation screen
  api/
    checkout/
      route.ts         ← dual-path route handler (Node runtime)
.env.example           ← commented-out Stripe keys
README.md              ← adds "Going live with Stripe" section
package.json           ← adds `stripe` to dependencies
```

Pricing CTAs live on the home page or `app/pricing/page.tsx` (the CTO picks one). The business plan's revenue streams dictate the billing shape. Each CTA builds a query string from the tier's declared cadence and starts the checkout flow:

```ts
// One-time:
`/checkout?tier=${encodeURIComponent(name)}&priceCents=${cents}&cadence=one_time`
// Subscription:
`/checkout?tier=${encodeURIComponent(name)}&priceCents=${cents}&cadence=monthly`  // or yearly
```

`priceCents` is the tier price × 100 (e.g. $19/mo → `1900`). `cadence` is `one_time`, `monthly`, or `yearly`.

## `app/api/checkout/route.ts` — the branch

Use the Node runtime (default) — the `stripe` SDK does not run on Edge. Keep the mock path free of any Stripe imports so `npm run build` works when no keys are present and when the `stripe` package is missing.

```ts
import { NextRequest, NextResponse } from 'next/server';

// Node runtime: the stripe SDK uses Node APIs.
export const runtime = 'nodejs';

type Cadence = 'one_time' | 'monthly' | 'yearly';
type CheckoutBody = { tier: string; priceCents: number; cadence: Cadence };

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: CheckoutBody;
  try {
    body = (await req.json()) as CheckoutBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
  }

  const { tier, priceCents, cadence } = body;
  const validCadence: Cadence[] = ['one_time', 'monthly', 'yearly'];
  if (
    !tier ||
    typeof priceCents !== 'number' ||
    priceCents <= 0 ||
    !validCadence.includes(cadence)
  ) {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const useStripe = typeof secretKey === 'string' && secretKey.startsWith('sk_');

  // --- Mock path (default). No Stripe import, no network call. ---
  if (!useStripe) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    return NextResponse.json({
      ok: true,
      order_id: crypto.randomUUID(),
      mode: cadence === 'one_time' ? 'payment' : 'subscription',
    });
  }

  // --- Real path. Dynamic import so the mock path stays Stripe-free. ---
  try {
    const StripeMod = await import('stripe');
    const Stripe = StripeMod.default;
    const stripe = new Stripe(secretKey!);

    const origin = req.nextUrl.origin;
    const isSubscription = cadence !== 'one_time';

    // price_data shape differs: subscriptions need `recurring`.
    const priceData: Record<string, unknown> = {
      currency: 'usd',
      product_data: { name: tier },
      unit_amount: priceCents,
    };
    if (isSubscription) {
      priceData.recurring = { interval: cadence === 'yearly' ? 'year' : 'month' };
    }

    const session = await stripe.checkout.sessions.create({
      mode: isSubscription ? 'subscription' : 'payment',
      payment_method_types: ['card'],
      line_items: [{ price_data: priceData, quantity: 1 }],
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    // Missing `stripe` package, bad key, network error — fall through to
    // the mock so the demo never breaks.
    console.warn('[checkout] stripe path failed, falling back to mock:', err);
    await new Promise((resolve) => setTimeout(resolve, 400));
    return NextResponse.json({
      ok: true,
      order_id: crypto.randomUUID(),
      fallback: true,
      mode: cadence === 'one_time' ? 'payment' : 'subscription',
    });
  }
}
```

Key points:
- `const useStripe = secretKey?.startsWith('sk_')` — matches `sk_test_` AND `sk_live_`. If the env var is blank, unset, or garbage, the mock fires.
- `await import('stripe')` is wrapped in try/catch so a missing dependency never 500s — it gracefully falls back to the mock.
- `crypto.randomUUID()` is globally available in Node 19+ / Next.js 14+.
- No webhook endpoint is required for the demo. The success page is reached by Stripe's `success_url` redirect in the real path, and by `router.push(...)` in the mock path.

## `app/checkout/page.tsx` — the client form

Reads `tier` and `priceCents` from the URL query string (the pricing CTA sets them). Submits to `/api/checkout` and handles both response shapes: `{url}` → redirect; `{order_id}` → client-side navigation.

```tsx
'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

type Cadence = 'one_time' | 'monthly' | 'yearly';

export default function CheckoutPage() {
  const router = useRouter();
  const params = useSearchParams();
  const tier = params.get('tier') ?? 'Standard';
  const priceCents = Number(params.get('priceCents') ?? 1900);
  const rawCadence = params.get('cadence') ?? 'one_time';
  const cadence: Cadence =
    rawCadence === 'monthly' || rawCadence === 'yearly' ? rawCadence : 'one_time';
  const cadenceLabel =
    cadence === 'monthly' ? '/ month' : cadence === 'yearly' ? '/ year' : 'one-time';

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tier, priceCents, cadence }),
      });
      const data = await res.json();
      if (data.url) {
        // Real Stripe Checkout — full-page redirect.
        window.location.href = data.url as string;
        return;
      }
      if (data.ok && data.order_id) {
        router.push(`/checkout/success?order_id=${data.order_id}`);
        return;
      }
      setError(data.error ?? 'Something went wrong.');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-md p-8">
      <div
        role="note"
        className="mb-6 rounded-md border border-[color:var(--accent)] bg-[color:var(--accent)]/10
          px-4 py-3 text-sm text-[color:var(--accent)]"
      >
        Demo checkout — no real payment will be taken. Test card:
        <code className="ml-1">4242 4242 4242 4242</code>
      </div>

      <h1 className="mb-2 text-2xl font-semibold">Checkout · {tier}</h1>
      <p className="mb-6 text-[color:var(--muted)]">
        ${(priceCents / 100).toFixed(2)} {cadenceLabel}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Cardholder name" name="name" placeholder="Alex Example" required />
        <Field
          label="Card number"
          name="card"
          placeholder="4242 4242 4242 4242"
          inputMode="numeric"
          required
        />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Expiry" name="expiry" placeholder="12 / 29" required />
          <Field label="CVC" name="cvc" placeholder="123" inputMode="numeric" required />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-[color:var(--accent)] px-4 py-3 font-semibold
            text-[color:var(--accent-foreground)] transition-opacity hover:opacity-90
            disabled:opacity-60"
        >
          {submitting ? 'Processing…' : `Pay $${(priceCents / 100).toFixed(2)}`}
        </button>
      </form>
    </main>
  );
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...rest } = props;
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-[color:var(--muted)]">{label}</span>
      <input
        {...rest}
        className="w-full rounded-md border border-[color:var(--border)] bg-transparent
          px-3 py-2 outline-none focus:border-[color:var(--accent)]"
      />
    </label>
  );
}
```

Customise the CSS variables (`--accent`, `--muted`, `--border`, `--accent-foreground`) to match the brand palette from `globals.css`. If the generated project uses Tailwind theme colors instead, swap `color:var(...)` for the named classes — the structure above is what matters.

## `app/checkout/success/page.tsx` — the confirmation

Works for both paths. Stripe's real redirect appends `?session_id=cs_test_...`; the mock appends `?order_id=<uuid>`. Show whichever one you got.

```tsx
import Link from 'next/link';

export default function SuccessPage({
  searchParams,
}: {
  searchParams: { order_id?: string; session_id?: string };
}) {
  const ref = searchParams.session_id ?? searchParams.order_id ?? 'n/a';
  const isReal = Boolean(searchParams.session_id);

  return (
    <main className="mx-auto max-w-md p-8 text-center">
      <div className="mb-4 text-5xl">🎉</div>
      <h1 className="mb-2 text-2xl font-semibold">
        {isReal ? 'Welcome aboard.' : 'Demo order confirmed.'}
      </h1>
      <p className="mb-6 text-[color:var(--muted)]">
        {isReal
          ? 'Your Stripe test session completed. No real money moved. Subscriptions cancel themselves after the test — nothing to clean up.'
          : 'This is a demo — no real payment was taken. Subscriptions recur if you wire up Stripe.'}
      </p>
      <p className="mb-8 text-xs text-[color:var(--muted)]">
        Reference: <code>{ref}</code>
      </p>
      <Link
        href="/"
        className="inline-block rounded-md border border-[color:var(--border)] px-4 py-2"
      >
        Back to home
      </Link>
    </main>
  );
}
```

Copy on the success page should lean into the bit — if the startup sells eleven-minute films, say "Your eleven-minute film will begin momentarily. (Just kidding — this is a demo.)". Stay in character.

## `.env.example`

Write it to the repo root. Every line commented out — the mock is the default.

```
# Optional — leave blank to use the built-in mock checkout.
# Paste your Stripe test keys to enable real Checkout.
# Get keys at https://dashboard.stripe.com/test/apikeys
# STRIPE_SECRET_KEY=sk_test_...
# STRIPE_PUBLISHABLE_KEY=pk_test_...
```

## `README.md` — "Going live with Stripe"

Append a short section to the generated README:

```markdown
## Going live with Stripe

Checkout runs in **mock mode** by default — clicking "Pay" fakes a successful
order after a brief delay. To switch to real Stripe test-mode Checkout:

1. Grab keys from [dashboard.stripe.com/test/apikeys](https://dashboard.stripe.com/test/apikeys).
2. `cp .env.example .env.local` and fill in the two `STRIPE_*` values.
3. Restart the dev server (`npm run dev`).

Test card: `4242 4242 4242 4242`, any future expiry, any CVC.

No webhook setup is required — the demo uses Stripe's success redirect.
```

## `package.json`

Add `stripe` to `dependencies`:

```json
{
  "dependencies": {
    "stripe": "^18.0.0"
  }
}
```

Run `npm install stripe` to update `package-lock.json`. The mock path does not import the package, so `npm run build` succeeds even if installation is skipped (but install it anyway — the real path will need it the moment someone adds keys).

## Testing the mock works

After scaffolding, run:

```bash
npm run dev
# One-time:
curl -X POST http://localhost:3000/api/checkout \
  -H 'content-type: application/json' \
  -d '{"tier":"Standard","priceCents":1900,"cadence":"one_time"}'
# Subscription:
curl -X POST http://localhost:3000/api/checkout \
  -H 'content-type: application/json' \
  -d '{"tier":"Pro","priceCents":1900,"cadence":"monthly"}'
```

Expect a ~800 ms delay, then `{"ok":true,"order_id":"<uuid>","mode":"payment"|"subscription"}`. If you get an error or a redirect, the branch is wrong — re-check `STRIPE_SECRET_KEY` is NOT set in your env, and that the mock path runs before any Stripe import.

Before marking the checkout step complete:
- Load `/checkout?tier=Pro&priceCents=1900&cadence=monthly` and click "Pay". You should end up on `/checkout/success?order_id=...`.
- Load `/checkout?tier=Lifetime&priceCents=9900&cadence=one_time` and click "Pay". Same success page, same flow.
- Verify `npm run build` succeeds with no env vars set.
- Verify `tsc --noEmit` is clean.
