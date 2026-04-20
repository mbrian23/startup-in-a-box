---
name: agent-flow
description: Teaches AI agents how Agent Flow works — a standalone web app that visualizes Claude Code agent execution as a live interactive node graph in the browser. Covers setup, hook integration, SSE event streaming, multi-session support, and the Silent Observer pattern for live demos.
---

## Description

**Agent Flow** (`patoles/agent-flow`) is a standalone web visualizer for Claude Code
agent orchestration. It renders tool calls, branching decisions, and sub-agent
coordination as a live interactive node graph in the browser.

**No VS Code required.** It runs as a plain web server — display it in any browser
on any screen.

In this project it implements the **Silent Observer** pattern: Screen 2 shows the
Software Factory agents working in real time via the node graph while Screen 1
shows the AG-UI orchestration interface.

## Quick Start

```bash
npx agent-flow-app
# Opens http://localhost:3001 automatically
# Options:
#   --port <n>    change port (default: 3001)
#   --no-open     don't auto-open browser
#   --verbose     detailed event logs
```

Hooks are auto-configured on first run. Start any Claude Code session — events
stream to the browser immediately.

## How It Works

- Installs Claude Code hooks → lightweight HTTP relay server receives events
- Events streamed to browser via **SSE** (`/events` endpoint)
- Browser renders a **node graph canvas**: tool calls are nodes, branching and
  sub-agent relationships are edges
- Multiple concurrent sessions shown as tabs
- No VS Code, no Docker, no database — pure HTTP + SSE

## Key Features

- **Live node graph** — pan, zoom, click nodes to inspect tool call details
- **Multi-session tabs** — track multiple concurrent Claude Code agents
- **Timeline panel** — full execution timeline + file attention heatmap
- **Transcript panel** — full message transcript alongside the graph
- **JSONL replay** — point at any `.jsonl` file to replay or watch offline
- **Zero-latency** — hooks deliver events directly, no polling

## References

- `references/setup.md` — installation, hook configuration, CLI options
- `references/architecture.md` — server internals, SSE relay, web canvas structure

## Source

https://github.com/patoles/agent-flow
