---
name: pixel-agents
description: Teaches AI agents how Pixel Agents works — a VS Code extension that visualizes Claude Code agents as animated pixel art characters in an office. Covers architecture, JSONL transcript parsing, hooks integration, agent lifecycle, and the Silent Observer pattern.
---

## Description

**Pixel Agents** (`pablodelucca.pixel-agents`) is a VS Code extension that makes
every Claude Code terminal session visible as an animated pixel art character in
a shared office. It is purely observational — no modifications to Claude Code are
needed.

In this project it implements the **Silent Observer** pattern: visualizing local
Claude Code execution during live demonstrations without interfering with the
agents themselves.

## How It Works

- Each Claude Code terminal gets one animated character (1:1 binding)
- Characters animate based on what the agent is actually doing:
  - **Typing** → Write / Edit / Bash / Task tools
  - **Reading** → Read / Grep / Glob / WebFetch tools
  - **Waiting** → speech bubble appears when agent needs permission/input
- Extension watches Claude Code's JSONL transcript files at:
  `~/.claude/projects/<project-hash>/<session-id>.jsonl`
- Project hash = workspace path with `:`, `\`, `/` replaced by `-`

## Two Detection Modes

| Mode | How | When |
|---|---|---|
| **Hooks** (preferred) | Claude Code Hooks API → HTTP server | Instant, reliable |
| **Heuristic** (fallback) | 500ms JSONL polling | When hooks unavailable |

Hooks mode suppresses all heuristic scanners when active.

## Key Concepts

- **Terminal** = VS Code terminal running Claude Code
- **Session** = JSONL conversation file for that terminal
- **Agent** = webview character bound 1:1 to a terminal
- **Sub-agents** = Task tool sub-agents spawn as separate characters linked to parent
- **Seats** = derived from chair furniture; characters pathfind to their assigned seat

## References

- `references/architecture.md` — full codebase structure, JSONL format, hooks events, rendering pipeline
- `references/integration.md` — how to integrate with or extend Pixel Agents (hooks, layout, assets)

## Install

VS Code Marketplace: `pablodelucca.pixel-agents`
Source: https://github.com/pablodelucca/pixel-agents
