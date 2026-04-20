# Startup in a Box — Web Edition

The talk that doesn't need PowerPoint. A full-screen, keyboard-driven
Next.js app that runs as the presentation itself.

## Quick start

```bash
cd web
npm install
npm run snapshot      # bake public/snapshot.json from real repo files
npm run dev           # http://localhost:7833
```

Production:

```bash
npm run build
npm run start         # http://localhost:7833
```

The dev port (`7833`) is deliberately uncommon to avoid colliding with the
rest of the stack: orchestrator `8000`, factory `8888`, frontend `3000`.

## Hotkeys

| key       | action                                           |
| --------- | ------------------------------------------------ |
| `F`       | toggle browser fullscreen                        |
| `P`       | toggle presenter view (speaker notes + timer)    |
| `O`       | toggle overview grid of all slides               |
| `/`       | "Ask the deck" — answers grounded in slide notes |
| `D`       | toggle fullscreen for the live-demo iframe       |
| `S`       | toggle SSE drawer                                |
| `.`       | blackout (screen goes black, keys still work)    |
| `G`       | goto slide N                                     |
| `← →`     | previous / next slide                            |
| `Ctrl/⌘`+wheel | zoom into the current slide (toward cursor) |
| `+` / `-` | zoom in / out                                    |
| `0`       | reset zoom & pan                                 |
| drag      | pan (only while zoomed in)                       |
| `space`   | next slide                                       |
| `Home/End`| first / last slide                               |
| `Esc`     | close any open overlay                           |

Slides deep-link via URL hash: `http://localhost:7833/#slide-17`.

## Environment variables

Optional, in `web/.env.local`:

```
# Enables "Ask the deck" via OpenRouter. If absent, the modal falls back to
# offline keyword matching against slide notes.
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=anthropic/claude-3.5-haiku
```

The key is only ever read from the server route (`/api/ask`) — it never ships
in the client bundle.

## Regenerating the codebase snapshot

`public/snapshot.json` is the static export of the real repo files that the
`<CodeView>` component reads. To refresh after source changes:

```bash
npm run snapshot
```

Add new files to `scripts/snapshot.mjs` → `TARGETS`.

## Spanish accent linter

Speaker notes are rioplatense Spanish. A conservative linter catches common
unaccented words:

```bash
npm run lint-accents
```

Exits non-zero on violation so CI can gate. See `NOTES-LINT.md` for the
rule set and why it's conservative.

## Projector preflight

Before the talk, in order:

1. Open the URL in Chrome, window mode.
2. Press `F` — confirm real-fullscreen at 1920×1080 (or the projector's native res).
3. Press `O` — eye the overview grid, look for any slide whose content clips the dialog box.
4. Walk `→` from slide 01 through 36 once. Mermaid slides (19, 32) take ~200ms to render — they should be legible, not tiny.
5. If the live demo stack is up (`make dev` at repo root), slide 33 iframes in. Press `D` to fullscreen.
6. Press `P` to confirm speaker notes render cleanly.

Fallback modes:

- No backend running → SSE drawer shows a mocked stream (lila dots); demo slide shows the offline placeholder.
- No `OPENROUTER_API_KEY` → Ask modal degrades to offline keyword matching.
- No `public/snapshot.json` → CodeView shows a `not in snapshot` warning per file.

## Tech

- Next.js 15 · React 19 · Tailwind · TypeScript
- Shiki (syntax highlighting) · Mermaid 11 + svg-pan-zoom (diagrams)
- `qrcode.react` (LinkedIn QR) · `next/font` for Press Start 2P / VT323 / JetBrains Mono
- No external state, no router magic. One `<Deck>` component owns everything.

## Scope isolation

All non-Tailwind CSS in `src/app/globals.css` is scoped under `#deck`. This is
a direct response to commit `c12ee0a`, which leaked ~398 lines of marketing
CSS into the main app's globals. Don't repeat it.
