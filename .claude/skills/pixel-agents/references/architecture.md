# Pixel Agents — Architecture Reference

Source: `pablodelucca/pixel-agents` CLAUDE.md

## Repo Structure

```
src/                          — Extension backend (Node.js, VS Code API)
  extension.ts                — Entry: activate(), deactivate()
  PixelAgentsViewProvider.ts  — WebviewViewProvider, message dispatch, asset loading, server lifecycle
  agentManager.ts             — Terminal lifecycle: launch, remove, restore, persist
  fileWatcher.ts              — fs.watch + polling, readNewLines, /clear detection
  transcriptParser.ts         — JSONL parsing: tool_use/tool_result → webview messages
  timerManager.ts             — Waiting/permission timer logic

server/src/
  server.ts                   — HTTP server: hook endpoint, health check, server.json discovery
  hookEventHandler.ts         — Routes hook events to agents, buffers pre-registration events
  providers/file/
    claudeHookInstaller.ts    — Install/uninstall hooks in ~/.claude/settings.json
    hooks/claude-hook.ts      — Hook script: reads stdin, POSTs to server

webview-ui/src/               — React + TypeScript (Vite)
  App.tsx                     — Composition root
  office/engine/
    characters.ts             — Character FSM: idle/walk/type/read + wander AI
    officeState.ts            — Game world: layout, characters, seats
    gameLoop.ts               — rAF loop with delta time
    renderer.ts               — Canvas: tiles, z-sorted entities, overlays
```

## JSONL Transcript Format

Files at: `~/.claude/projects/<project-hash>/<session-id>.jsonl`

Project hash = workspace path with `:` / `\` / `/` → `-`

**Record types parsed:**

| Type | Subtype / field | Effect |
|---|---|---|
| `assistant` | `tool_use` blocks | → `agentToolStart` message |
| `user` | `tool_result` | → `agentToolDone` message (delayed 300ms) |
| `system` | `subtype: "turn_duration"` | Reliable turn-end signal; clears all tool state |
| `progress` | `data.type: "agent_progress"` | Sub-agent tool forwarded to parent |
| `progress` | `data.type: "bash_progress"` | Long Bash output; restarts permission timer |
| `progress` | `data.type: "mcp_progress"` | MCP tool status; same timer restart |

**Idle detection:**
1. `turn_duration` system record — reliable for tool-using turns (~98%)
2. Text-idle timer (5s) — for text-only turns; suppressed if any tool_use seen in turn

**File watching:** 500ms polling + `fs.watch` backup (fs.watch unreliable on Windows).
Partial line buffering essential — carry unterminated lines across reads.

**`/clear` handling:** Creates a NEW JSONL file; old file stops. Content-based detection
(`/clear</command-name>` in first 8KB).

## Hooks Mode (11 Events)

HTTP server at `~/.pixel-agents/server.json` (port + PID + auth token). Hook script
(`~/.pixel-agents/hooks/claude-hook.js`) receives events and POSTs to server.

| Hook | Purpose |
|---|---|
| `SessionStart` | Session begin / resume / clear |
| `SessionEnd` | Exit or clear |
| `Stop` | Turn complete (most reliable idle signal) |
| `PermissionRequest` | Show permission bubble |
| `Notification` | Idle / permission prompt |
| `UserPromptSubmit` | Instant agent spawn confirmation |
| `PreToolUse` | Instant active state |
| `PostToolUse` | Tool complete |
| `SubagentStart` / `SubagentStop` | Spawn/despawn sub-agent characters |

When hooks active → all heuristic scanners (1s main, 3s external, 30s stale) are skipped.

## Extension ↔ Webview Message Protocol

Key messages (via `postMessage`):

| Message | Direction | Purpose |
|---|---|---|
| `openClaude` | → webview | New terminal spawned |
| `agentCreated` / `agentClosed` | → webview | Character spawn/despawn |
| `agentToolStart` / `agentToolDone` | → webview | Animate typing/reading |
| `agentStatus` | → webview | waiting / active / idle |
| `layoutLoaded` | → webview | Office layout from file |
| `furnitureAssetsLoaded` | → webview | Catalog + sprites |
| `saveLayout` | webview → | Persist layout to `~/.pixel-agents/layout.json` |
| `settingsLoaded` | → webview | Sound, debug, externalAssetDirectories |

## Agent State (per terminal)

```ts
{
  id, terminalRef, projectDir, jsonlFile,
  fileOffset, lineBuffer,
  activeToolIds, activeToolStatuses,
  activeSubagentToolNames,
  isWaiting
}
```

## Persistence

| What | Where |
|---|---|
| Layout | `~/.pixel-agents/layout.json` (shared across all VS Code windows) |
| Config (external asset dirs) | `~/.pixel-agents/config.json` |
| Agents (per workspace) | VS Code `workspaceState` key `pixel-agents.agents` |

Layout writes are atomic (`.tmp` + rename). Cross-window sync via hybrid `fs.watch` + 2s polling.

## Rendering

- Pixel-perfect: zoom = integer device-pixels-per-sprite-pixel (1×–10×)
- No `ctx.scale(dpr)` — default zoom = `Math.round(2 * devicePixelRatio)`
- Z-sort all entities by Y coordinate
- Character FSM: idle (wander) → walk (pathfind to seat) → type / read
- Spawn/despawn: matrix-style digital rain animation (0.3s)
- Sub-agents: negative IDs, same palette as parent, click focuses parent terminal

## TypeScript Constraints

- No `enum` — use `as const` objects (`erasableSyntaxOnly`)
- `import type` required for type-only imports (`verbatimModuleSyntax`)
- `noUnusedLocals` / `noUnusedParameters` enforced
- All magic numbers in `src/constants.ts` (extension) or `webview-ui/src/constants.ts` (webview) — never inline
