---
name: vercel-neon
description: Use this skill whenever a build step needs persistent storage — waitlist emails, user-submitted listings, order history, form submissions, saved prefs, etc. Covers provisioning a Neon Postgres database via Vercel Marketplace automatically at deploy time, wiring Next.js to read/write via the `@neondatabase/serverless` driver, and — critically — shipping a zero-env mock so the site runs locally without any database credentials. Do NOT invoke this skill when the site is purely static (no user-submitted state, no persistence). Most landing pages do not need it.
---

# Vercel + Neon — Dual-Path Database

Use when, and ONLY when, the business plan requires persistence. Static marketing pages + mock checkout do not need this skill. Examples that DO need it:

- "Submit your idea to our waitlist" — one `waitlist_signups` table.
- "Browse user-submitted candles" — a `listings` table plus an admin mock-seed.
- "Save your preferred film length" — a `preferences` table keyed on a cookie.

Same dual-path contract as `stripe-checkout`: **mock by default, real when `DATABASE_URL` is set.** The site runs locally with zero env vars; the repo owner plugs Neon in via one CLI call.

## File checklist

```
lib/
  db.ts                ← dual-path DB handle (real Neon | in-memory mock)
  schema.sql           ← idempotent CREATE TABLE statements (commit this)
app/
  api/<resource>/route.ts  ← reads/writes via lib/db.ts
.env.example           ← documents DATABASE_URL (commented out)
README.md              ← adds "Enable persistence" section
package.json           ← adds `@neondatabase/serverless` to dependencies
```

No ORM. No migrations library. One `schema.sql`, one `lib/db.ts`, one driver. Keeping it minimal is the point — the factory is not shipping Prisma.

## `lib/db.ts` — the handle

Branches on `process.env.DATABASE_URL`. The mock is a tiny in-memory store keyed by table name — identical interface, different backing store, so API routes don't care which path is live.

```ts
// lib/db.ts
//
// Dual-path database:
//   - DATABASE_URL set → real Neon over HTTP (@neondatabase/serverless).
//   - DATABASE_URL absent → in-memory store (resets on server restart).
//
// The shape returned by `sql` is always `Row[]` — rows array, never undefined.

import { randomUUID } from 'node:crypto';

type Row = Record<string, unknown>;
type QueryFn = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<Row[]>;

const url = process.env.DATABASE_URL;
const hasDatabase = typeof url === 'string' && url.startsWith('postgres');

export const databaseEnabled = hasDatabase;

export const sql: QueryFn = hasDatabase
  ? await createNeonClient(url!)
  : createMockClient();

async function createNeonClient(databaseUrl: string): Promise<QueryFn> {
  try {
    const mod = await import('@neondatabase/serverless');
    const client = mod.neon(databaseUrl);
    return client as unknown as QueryFn;
  } catch (err) {
    console.warn('[db] @neondatabase/serverless unavailable, using mock:', err);
    return createMockClient();
  }
}

function createMockClient(): QueryFn {
  const tables = new Map<string, Row[]>();

  return async function sql(strings, ...values) {
    const text = strings.join('?').trim().toLowerCase();

    // Extremely small parser: recognises `insert into <t>`, `select ... from <t>`,
    // and `delete from <t>`. Matches the shapes the generated API routes use.
    const insert = text.match(/^insert into (\w+)/);
    if (insert) {
      const table = insert[1];
      const row: Row = { id: randomUUID(), created_at: new Date().toISOString() };
      for (let i = 0; i < values.length; i += 1) row[`col_${i}`] = values[i];
      const rows = tables.get(table) ?? [];
      rows.push(row);
      tables.set(table, rows);
      return [row];
    }

    const select = text.match(/from (\w+)/);
    if (select) return [...(tables.get(select[1]) ?? [])];

    const del = text.match(/^delete from (\w+)/);
    if (del) {
      tables.delete(del[1]);
      return [];
    }

    return [];
  };
}
```

Use it like this in any route handler:

```ts
import { sql, databaseEnabled } from '@/lib/db';

export async function POST(req: Request) {
  const { email } = await req.json();
  const [row] = await sql`
    INSERT INTO waitlist_signups (email) VALUES (${email})
    RETURNING id, email, created_at
  `;
  return Response.json({ ok: true, id: row.id, persisted: databaseEnabled });
}
```

The `persisted: databaseEnabled` flag lets the frontend display "added to waitlist" vs. "demo submission" if you want to be honest about the mode.

## `lib/schema.sql` — the schema

Commit the schema as a plain SQL file. The repo owner runs it once against their Neon DB (or Vercel's integration runs it automatically — see below). Keep it idempotent.

```sql
-- Example for a waitlist app. Shape yours after the business plan's data needs.
CREATE TABLE IF NOT EXISTS waitlist_signups (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT        NOT NULL UNIQUE,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_waitlist_created_at
  ON waitlist_signups (created_at DESC);
```

Write tables that match the business plan. A "Slack for goldfish owners" might need `fish_profiles` + `message_threads`. A half-candle marketplace might need `listings` + `buyer_interests`. Shape the schema to the bit.

## `.env.example`

```
# Optional — leave blank to use the built-in in-memory mock database.
# Paste your Neon Postgres URL to enable persistence.
# Get a free database at https://console.neon.tech (or let Vercel provision
# one automatically: vercel integration add neon on this project).
# DATABASE_URL=postgres://user:pass@host/db?sslmode=require
```

## `README.md` — "Enable persistence"

```markdown
## Enable persistence (Neon Postgres)

The app runs in **mock-db mode** by default — every `INSERT`, `SELECT`, and
`DELETE` against an in-memory map that resets on restart. To switch to a real
Neon Postgres:

**Option A — Vercel Marketplace (recommended):**

```
vercel link
vercel integration add neon
vercel env pull .env.local
```

Neon provisions a branch, injects `DATABASE_URL` into every Vercel environment,
and `vercel env pull` mirrors it locally.

**Option B — bring your own Neon:**

1. Create a free DB at [console.neon.tech](https://console.neon.tech).
2. `cp .env.example .env.local` and set `DATABASE_URL`.
3. Run the schema once: `psql "$DATABASE_URL" -f lib/schema.sql`.
4. Restart the dev server.

The API routes work identically in both modes.
```

## `package.json`

Add `@neondatabase/serverless` to `dependencies`:

```json
{
  "dependencies": {
    "@neondatabase/serverless": "^0.10.0"
  }
}
```

The mock path never imports the package, so `npm run build` succeeds with or without installation.

## Auto-provisioning at deploy time (devops subagent)

The factory's devops subagent deploys to Vercel with `$VERCEL_TOKEN`. To also attach a Neon database automatically, add these commands after `vercel link` and before `vercel --prod`:

```bash
# One-liner that is safe to run repeatedly — idempotent if Neon is
# already attached to this project.
vercel integration add neon --yes || true

# Pull the freshly-injected DATABASE_URL so local dev uses the same DB
# the deploy uses. Harmless if Neon wasn't added (file stays empty).
vercel env pull .env.local || true

# Apply the schema. If DATABASE_URL is still unset, fall back gracefully.
if [ -n "$DATABASE_URL" ]; then
  psql "$DATABASE_URL" -f lib/schema.sql
fi
```

**Prerequisite** (repo owner, one-time): install the Neon integration on the Vercel team from [vercel.com/marketplace/neon](https://vercel.com/marketplace/neon) and accept the OAuth consent. After that, `vercel integration add neon` works non-interactively on every subsequent project.

If the integration isn't installed, `vercel integration add` fails cleanly — the site deploys with an empty `DATABASE_URL` and the mock path serves as before. Never let this step block a deploy.

## Testing the mock works

```bash
npm run dev
# In another shell, against whatever route you wrote:
curl -X POST http://localhost:3000/api/waitlist \
  -H 'content-type: application/json' \
  -d '{"email":"a@b.test"}'
# → {"ok":true,"id":"<uuid>","persisted":false}

curl http://localhost:3000/api/waitlist
# → [{"id":"...","col_0":"a@b.test","created_at":"..."}]
```

Expect `"persisted": false` with no `DATABASE_URL`, `"persisted": true` once set. If the server crashes on boot, you probably imported `@neondatabase/serverless` at the top level — it must only be imported inside `createNeonClient` behind the `hasDatabase` gate.

Before marking any DB step complete:
- Verify `npm run build` succeeds with no env vars.
- Verify `tsc --noEmit` is clean.
- Verify one write + one read against the mock returns the expected shape.

## When NOT to use this skill

- The business plan has no user-submitted data.
- "Preferences" that only need a cookie or localStorage.
- Analytics (use Vercel Analytics or Plausible instead).

If the CTO's BuildPlan doesn't explicitly call out a DB step, do not add one. The static path ships faster and breaks less.
