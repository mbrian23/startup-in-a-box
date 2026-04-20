---
name: ag-ui-claude-sdk
description: Teaches AI agents how to implement AG-UI protocol using the Claude Agent SDK via the ag-ui-claude-sdk Python package. Covers ClaudeAgentAdapter setup, FastAPI endpoint mounting, HITL workflows, shared state, MCP tools, and session persistence.
---

## Description

`ag-ui-claude-sdk` bridges Anthropic's **Claude Agent SDK** to the **AG-UI Protocol**.
`ClaudeAgentAdapter` wraps the SDK internally and translates every SDK event into
standard AG-UI protocol events streamed via SSE.

This is the Software Factory layer in this project — it receives delegated tasks
from the ADK orchestrator and streams execution progress to the Screen 2 frontend.

## Key Classes

- **`ClaudeAgentAdapter`** — wraps Claude Agent SDK, emits AG-UI events, manages session workers per `thread_id`
- **`add_claude_fastapi_endpoint`** — mounts adapter as a FastAPI `POST` route with SSE streaming

## Supported AG-UI Events

`RUN_STARTED/FINISHED/ERROR`, `TEXT_MESSAGE_START/CONTENT/END`,
`TOOL_CALL_START/ARGS/END`, `STATE_SNAPSHOT/DELTA`,
`REASONING_START/CONTENT/END`, `MESSAGES_SNAPSHOT`, `CUSTOM`

## Five Patterns (from official examples)

| Pattern | Route | Key feature |
|---|---|---|
| Basic chat | `/agentic_chat` | Simple conversation |
| Backend tool | `/backend_tool_rendering` | Custom MCP tool, rendered in UI |
| Shared state | `/shared_state` | Bidirectional state sync via `ag_ui_update_state` |
| HITL | `/human_in_the_loop` | Frontend tools + pause/resume approval |
| Generative UI | `/tool_based_generative_ui` | Dynamic frontend-rendered components |

## References

- `references/usage.md` — all usage patterns, code examples, MCP tools, session config
- `references/architecture.md` — internals: adapter, session workers, event translation

## Installation

```bash
uv add ag-ui-claude-sdk
```

Source: `ag-ui-protocol/ag-ui` → `integrations/claude-agent-sdk/python/`
