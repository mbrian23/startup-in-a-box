# Agent Flow — Architecture Reference

Source: `patoles/agent-flow`

## Repo Structure

```
app/src/
  app.ts        — CLI entry point (parses args, calls startServer)
  args.ts       — CLI argument definitions (--port, --no-open, --verbose, --event-log)
  server.ts     — Combined HTTP server: serves UI + SSE relay
  static.ts     — Serves built web UI as static files

scripts/
  relay.ts      — createRelay(): hooks into Claude Code hook events,
                  bridges JSONL transcript watching + hook server → SSE

web/             — React + TypeScript frontend (Vite)
  app-entry.tsx          — Standalone web app entry
  webview-entry.tsx      — VS Code webview entry
  components/            — UI components (canvas, panels, toolbar)
  hooks/
    use-canvas-camera.ts      — Pan/zoom state for node graph canvas
    use-canvas-interaction.ts — Click, hover, drag on canvas nodes
    use-agent-simulation.ts   — Mock simulation for dev/testing
    use-vscode-bridge.ts      — VS Code ↔ webview message bridge
  lib/
    agent-types.ts        — TypeScript types for agent/tool events
    bridge-types.ts       — Message types for VS Code bridge
    canvas-constants.ts   — Node graph layout constants
    colors.ts             — Node/edge color scheme
    vscode-bridge.ts      — postMessage bridge implementation
    audio-engine.ts       — Optional audio feedback

extension/       — VS Code extension wrapper (optional)
```

## Server Architecture

```
Claude Code Hooks
      ↓ HTTP POST
  Relay Server (scripts/relay.ts)
      ↓ SSE
  Browser (/events endpoint)
      ↓ React
  Node Graph Canvas
```

**`app/src/server.ts`** creates a plain `http.createServer`:
- `GET /events` → SSE endpoint, handled by `relay.handleSSE(req, res)`
- All other `GET` → static file serving (built web UI)

**`scripts/relay.ts`** — the core bridge:
- Connects to Claude Code hooks (HTTP hook receiver)
- Tails JSONL transcript files for sessions in the workspace
- Forwards all events to SSE clients subscribed via `/events`

## Event Flow

1. Claude Code fires a hook event (e.g. `PreToolUse`, `PostToolUse`, `Stop`)
2. Hook script POSTs event to relay server
3. Relay broadcasts via SSE to all connected browser clients
4. Browser parses event → updates node graph state
5. Canvas re-renders: new tool node, updated edge, status change

## Node Graph Canvas

- Built on **Canvas 2D API** (no WebGL, no D3)
- Nodes = tool calls (colored by tool type)
- Edges = execution flow (sequential) + sub-agent relationships (hierarchical)
- Camera: pan via drag, zoom via scroll/pinch
- Click a node → detail panel shows full tool call payload + result
- Multiple sessions = multiple tabs, each with independent graph state

## Multi-Session Support

Each Claude Code session gets its own tab. Sessions are auto-detected from:
1. Hook events (session ID in payload)
2. JSONL file watching in the workspace directory

## JSONL Replay Mode

Pass `--event-log <path>` (CLI) or `agentVisualizer.eventLogPath` (VS Code setting).
Relay tails the file and streams events as they arrive — works for both replay and
live watching of existing sessions.

## VS Code Extension Mode

`extension/` wraps the same web app in a VS Code `WebviewPanel`. Communication via
`use-vscode-bridge.ts` / `vscode-bridge.ts` (`postMessage` protocol). The extension
auto-configures Claude Code hooks on first open via **Agent Flow: Configure Claude Code Hooks**.
