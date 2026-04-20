---
name: ag-ui
description: Teaches AI agents how to correctly implement the AG-UI Protocol in Python using the ag-ui-adk middleware to bridge Google ADK agents with frontend applications.
---

## Description

This skill enables correct implementation of the AG-UI (Agent-User Interaction)
Protocol in Python, specifically via the `ag-ui-adk` middleware that bridges
Google ADK agents to AG-UI-compatible frontends using FastAPI + SSE.

## Core Concepts

- **AG-UI Protocol**: Event-based protocol standardizing how agents communicate
  with user interfaces. Agents emit typed events; frontends consume them.
- **`ag-ui-adk`**: Python middleware package that wraps a Google ADK agent in
  an `ADKAgent` class and exposes it as a FastAPI endpoint.
- **`AGUIToolset`**: Exposes client-side (frontend) tools to ADK agents.
- **`add_adk_fastapi_endpoint`**: Mounts the ADK agent as a FastAPI route.

## Event Types

| Event | Description |
|---|---|
| `RUN_STARTED` / `RUN_FINISHED` | Agent execution lifecycle |
| `TEXT_MESSAGE_START/CONTENT/END` | Streaming text output |
| `TOOL_CALL_START/ARGS/END` | Tool invocation lifecycle |
| `STATE_SNAPSHOT` | Full frontend state replacement |
| `STATE_DELTA` | Incremental JSON Patch (RFC 6902) state update |
| `MESSAGES_SNAPSHOT` | Full conversation history |

## Usage

For all AG-UI + ADK Python implementation tasks, refer to
`references/ag-ui-adk.md` for patterns, code examples, and API details.
