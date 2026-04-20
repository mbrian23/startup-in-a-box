# agent-flow — vendored subtree

This directory contains a vendored copy of the `web/` subtree of
[github.com/patoles/agent-flow](https://github.com/patoles/agent-flow),
distributed under the Apache License 2.0 (see `LICENSE`) with
trademark terms in `TRADEMARK.md`.

## Upstream pin

- Repo:   https://github.com/patoles/agent-flow
- Commit: `a7ff6ff12a18e06d006b3d26d8e6e09e638e2e3d`
- Date:   vendored 2026-04-14

## What we copied

Everything under `upstream:web/{components,hooks,lib}/**`, verbatim, into
`./web/`. The copy was done with `cp -r` to avoid hand-rewriting files
and to keep future resync diffs readable.

## What we removed (not copied)

Upstream build / entry files that don't apply to our integration path:

- `upstream:web/app/**` — Next.js app shell (we host the component in our own app)
- `upstream:web/app-entry.tsx`, `web/webview-entry.tsx` — standalone entry points
- `upstream:web/next.config.mjs`, `postcss.config.mjs`, `tsconfig.json`,
  `components.json`, all `vite.config.*.ts`, `package.json` — build configs
  replaced by our frontend's own
- `upstream:web/public/**` — favicons not needed (we host our own)

## What we edited after copying

Tracked so we can diff cleanly against a future upstream update:

- `web/hooks/use-vscode-bridge.ts` — replaced with a no-op re-export so
  internal imports still resolve. The real bridge lives outside this
  tree at `frontend/src/lib/agent-flow-bridge.ts`.
- `web/lib/mock-scenario.ts`, `web/lib/stress-test-scenario.ts` —
  removed (demo data we don't ship). `web/hooks/use-agent-simulation.ts`
  was edited to drop the dead imports.
- `web/components/agent-visualizer/session-tabs.tsx` — removed.
  We run a single factory session per page load. Consumers inside
  `components/agent-visualizer/index.tsx` that reference it are edited
  to render nothing in place of the tabs.

No other source edits — everything else is upstream-identical.

## Re-syncing to a newer upstream

```bash
# 1. clone upstream at target SHA
git clone --depth 1 https://github.com/patoles/agent-flow /tmp/af-new

# 2. diff our vendored tree against it
diff -ruN /tmp/af-new/web frontend/vendor/agent-flow/web

# 3. apply the delta, then update the commit SHA above.
```
