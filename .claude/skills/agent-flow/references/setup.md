# Agent Flow — Setup & Usage Reference

## Standalone Web App (Recommended for Demo)

```bash
# Run directly — no install needed
npx agent-flow-app

# With options
npx agent-flow-app --port 3001 --no-open --verbose
```

Opens `http://localhost:3001`. Start a Claude Code session in another terminal —
events stream in real time.

## Build From Source

```bash
git clone https://github.com/patoles/agent-flow.git
cd agent-flow
pnpm i
pnpm run setup   # configure Claude Code hooks (one-time)
pnpm run dev     # start web app + event relay at http://localhost:3000
```

## Hook Configuration

Hooks are auto-configured on first run of `npx agent-flow-app`. To manually
reconfigure from the VS Code extension: **Agent Flow: Configure Claude Code Hooks**.

Hook events are received by the relay server and forwarded as SSE to browser clients.

## JSONL Replay

Point Agent Flow at any `.jsonl` file to replay or tail it:

```bash
npx agent-flow-app --event-log ~/.claude/projects/<project-hash>/<session-id>.jsonl
```

Or in VS Code settings: `agentVisualizer.eventLogPath`.

## VS Code Extension (Optional)

Available in the VS Code Marketplace as a wrapper around the same web app.

| Command | Description |
|---|---|
| `Agent Flow: Open Agent Flow` | Open visualizer panel |
| `Agent Flow: Open Agent Flow to Side` | Open in side column |
| `Agent Flow: Configure Claude Code Hooks` | Set up hooks manually |
| `Agent Flow: Connect to Running Agent` | Connect to an existing session |

Keyboard shortcut: `Cmd+Alt+A` (Mac) / `Ctrl+Alt+A` (Win/Linux)

VS Code settings:

| Setting | Default | Description |
|---|---|---|
| `agentVisualizer.devServerPort` | `0` | Dev server port (0 = production mode) |
| `agentVisualizer.eventLogPath` | `""` | JSONL file to watch |
| `agentVisualizer.autoOpen` | `false` | Auto-open on session start |

## Demo Setup (Startup in a Box)

1. Run `npx agent-flow-app` on the demo machine
2. Display `http://localhost:3001` on Screen 2
3. Start Claude Code sessions via the ADK handoff tool
4. Agent Flow auto-detects sessions and renders them as node graph tabs

Screen 1: AG-UI orchestration interface
Screen 2: Agent Flow node graph (the Software Factory in action)

## Requirements

- Node.js 20+ (LTS)
- Claude Code CLI
- pnpm (only if building from source)
