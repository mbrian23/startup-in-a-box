# Pixel Agents — Integration Reference

## Silent Observer Pattern

Pixel Agents is **read-only** — it never modifies Claude Code, writes to sessions,
or interrupts agent execution. It observes JSONL transcripts passively.

This makes it ideal as a "Silent Observer" for live demos: audiences see agents
working in real time via the pixel art UI without any impact on what the agents do.

## Using Pixel Agents in a Project

### 1. Install the extension
```
VS Code → Extensions → search "Pixel Agents" → Install
```
Or: `pablodelucca.pixel-agents` from the marketplace.

### 2. Spawn agents
- Open the **Pixel Agents** panel (bottom panel area, alongside terminal)
- Click **+ Agent** → spawns a new Claude Code terminal + animated character
- Right-click **+ Agent** → launch with `--dangerously-skip-permissions`

### 3. Hooks setup (recommended)
Enable hooks for instant, reliable detection (vs heuristic polling fallback):
- Open Settings modal in the panel → toggle **Hooks**
- Installs hook script to `~/.claude/settings.json` automatically

Hook script location after install: `~/.pixel-agents/hooks/claude-hook.js`
Server discovery file: `~/.pixel-agents/server.json`

## Layout Customization

Layout is shared across all VS Code windows, stored at `~/.pixel-agents/layout.json`.

- Click **Layout** button to open the editor
- Tools: Select, Floor paint, Wall paint, Erase, Furniture place, Eyedropper
- **R** = rotate furniture, **T** = toggle on/off state
- Ctrl+Z / Ctrl+Y = undo/redo (50 levels)
- Grid: expandable up to 64×64 tiles (default 20×11)
- Export/Import layouts as JSON via Settings modal

## External Asset Directories

Load custom furniture packs from any local folder:
- Settings modal → **Add Asset Directory**
- Each item needs a folder under `assets/furniture/` with a `manifest.json`
- See `docs/external-assets.md` in the repo for manifest format

## Sub-Agent Visualization

When Claude Code uses the `Task` tool to spawn sub-agents:
- Sub-agents appear as separate characters linked to their parent
- Click a sub-agent → focuses the parent terminal
- Sub-agents spawn at the nearest free seat to the parent
- Sub-agents are not persisted (disappear on session end)

## Sound Notifications

Optional ascending two-note chime (E5→E6) via Web Audio API plays when an agent
enters waiting state. Toggle in Settings modal → **Sound Notifications**.

## Debug View

Settings modal → toggle **Debug View** to show per-agent diagnostics:
- JSONL file status, lines parsed, last data timestamp, file path
- "JSONL not found" = extension can't locate the session file

## Build From Source

```bash
git clone https://github.com/pablodelucca/pixel-agents.git
cd pixel-agents
npm install
cd webview-ui && npm install && cd ..
npm run build
# Press F5 in VS Code to launch Extension Development Host
```

Tests:
```bash
npm test              # all tests
npm run test:server   # server unit tests (Vitest)
npm run test:webview  # webview asset integration tests
npm run e2e           # Playwright E2E (real VS Code instance)
```

## Key Implementation Notes

- `fs.watch` is unreliable on Windows — always paired with polling backup
- Partial line buffering is essential for append-only JSONL reads
- `agentToolDone` is delayed 300ms to prevent React batching from hiding brief active states
- User prompt `content` can be `string` (text) or `array` (tool_results) — handle both
- `/clear` creates a NEW JSONL file; old file just stops receiving data
