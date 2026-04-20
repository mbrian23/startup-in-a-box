# AG-UI ADK Middleware - Python Reference

## Source of Truth

- **Package**: `ag-ui-adk` on PyPI
- **Middleware source**: `ag-ui-protocol/ag-ui` → `integrations/adk-middleware/python/`
- **Docs**: https://docs.ag-ui.com
- **AG-UI Dojo** (live test harness): https://dojo.ag-ui.com/adk-middleware/feature/shared_state
- **CopilotKit ADK docs**: https://docs.copilotkit.ai/adk

## Installation

```bash
uv add ag-ui-adk
```

## Option 1: Basic FastAPI Server (no HITL)

```python
from fastapi import FastAPI
from ag_ui_adk import ADKAgent, add_adk_fastapi_endpoint, AGUIToolset
from google.adk.agents import Agent

my_agent = Agent(
    name="assistant",
    model="gemini-2.5-flash",
    instruction="You are a helpful assistant.",
    tools=[AGUIToolset()],  # exposes client-side tools to the agent
)

agent = ADKAgent(
    adk_agent=my_agent,
    app_name="my_app",
    user_id="user123",
)

app = FastAPI()
add_adk_fastapi_endpoint(app, agent, path="/chat")
# Run: uvicorn your_module:app --host 0.0.0.0 --port 8000
```

## Option 2: Human-in-the-Loop (HITL) — Recommended

Use `ADKAgent.from_app()` with `ResumabilityConfig`. Required for pause/resume
workflows where a user approves agent actions before execution continues.

```python
from fastapi import FastAPI
from ag_ui_adk import ADKAgent, add_adk_fastapi_endpoint, AGUIToolset
from google.adk.agents import Agent
from google.adk.apps import App, ResumabilityConfig

my_agent = Agent(
    name="assistant",
    model="gemini-2.5-flash",
    instruction="You are a helpful assistant.",
    tools=[AGUIToolset()],
)

adk_app = App(
    name="my_app",
    root_agent=my_agent,
    resumability_config=ResumabilityConfig(is_resumable=True),
)

agent = ADKAgent.from_app(
    adk_app,
    user_id="user123",
    use_in_memory_services=True,
)

app = FastAPI()
add_adk_fastapi_endpoint(app, agent, path="/chat")
```

**HITL flow:**
1. Agent calls a client-side tool → ADK persists the `FunctionCall` and pauses
2. Middleware emits `TOOL_CALL_START/ARGS/END` to frontend
3. User approves/rejects → frontend sends `ToolMessage` back
4. Middleware resumes ADK execution from stored `invocation_id`

> **Note:** `ADKAgent(adk_agent=...)` direct constructor is still valid for
> agents **without** client-side tools. The HITL path via direct constructor
> is deprecated — use `from_app()` for HITL.

## Option 3: Multiple Agents on Separate Endpoints

```python
app = FastAPI()
add_adk_fastapi_endpoint(app, orchestrator_agent, path="/agents/orchestrator")
add_adk_fastapi_endpoint(app, factory_agent, path="/agents/factory")
```

## AGUIToolset — Filtering Client Tools

```python
# All client tools (default)
tools=[AGUIToolset()]

# Specific tools only
tools=[AGUIToolset(tool_filter=["sayHello", "approveStep"])]

# Lambda filter
tools=[AGUIToolset(tool_filter=lambda tool, readonly_context=None: tool.name.startswith("ui_"))]
```

## Passing State from Frontend

```python
from ag_ui.core import RunAgentInput, UserMessage

input = RunAgentInput(
    thread_id="thread_001",
    run_id="run_001",
    messages=[UserMessage(id="1", role="user", content="Hello!")],
    state={
        "selected_document": "doc-456",
        "user_preferences": {"language": "en"},
    },
    context=[],
    tools=[],
    forwarded_props={},
)
```

State initializes the ADK session on first request for a `thread_id`; merges
on subsequent requests. Accessible in tools via `tool_context.session.state`.

## Context (Per-Request Metadata)

```python
from ag_ui.core import Context

input = RunAgentInput(
    ...
    context=[
        Context(description="user_role", value="admin"),
        Context(description="preferred_language", value="Spanish"),
    ],
)
```

**Access in tools:**
```python
from google.adk.tools import ToolContext
from ag_ui_adk import CONTEXT_STATE_KEY

def my_tool(tool_context: ToolContext) -> str:
    ctx = tool_context.state.get(CONTEXT_STATE_KEY, [])
    for item in ctx:
        if item["description"] == "user_role":
            return f"Role: {item['value']}"
```

**Access in dynamic instructions:**
```python
from google.adk.agents.readonly_context import ReadonlyContext
from ag_ui_adk import CONTEXT_STATE_KEY

def dynamic_instructions(ctx: ReadonlyContext) -> str:
    base = "You are a helpful assistant."
    for item in ctx.state.get(CONTEXT_STATE_KEY, []):
        if item["description"] == "preferred_language":
            base += f"\nRespond in {item['value']}."
    return base

agent = LlmAgent(name="assistant", model="gemini-2.5-flash", instruction=dynamic_instructions)
```

## Predictive State Updates

Stream state to the frontend in real-time as tool arguments arrive:

```python
from ag_ui_adk import PredictStateMapping

adk_agent = ADKAgent(
    adk_agent=agent,
    app_name="my_app",
    user_id="user123",
    predict_state=[
        PredictStateMapping(
            state_key="document",     # frontend state key
            tool="write_document",    # tool to watch
            tool_argument="document", # argument to stream
        )
    ],
)
```

## Session Configuration

```python
# Development (default — in-memory)
agent = ADKAgent(adk_agent=my_agent, app_name="app", user_id="user", use_in_memory_services=True)

# Production
from google.adk.memory import VertexAIMemoryService
agent = ADKAgent(
    adk_agent=my_agent,
    app_name="app",
    user_id="user",
    memory_service=VertexAIMemoryService(),
    use_in_memory_services=False,
)
```

## Dynamic App/User Extraction (Multi-Tenant)

```python
def extract_user(input: RunAgentInput) -> str:
    for ctx in input.context:
        if ctx.description == "user":
            return ctx.value
    return f"anon_{input.thread_id}"

agent = ADKAgent(
    adk_agent=my_agent,
    app_name="my_app",
    user_id_extractor=extract_user,
)
```

## Header Extraction

```python
add_adk_fastapi_endpoint(
    app, agent, path="/chat",
    extract_headers=["x-user-id", "x-tenant-id"],  # available in state.headers
)
```

## Key Rules

- Always add `AGUIToolset()` to the ADK agent's `tools` list (not to `ADKAgent`)
- Use `ADKAgent.from_app()` + `ResumabilityConfig` for any HITL workflow
- `thread_id` is the AG-UI identifier; the middleware maps it to ADK's `session_id` internally
- Use `uv add ag-ui-adk` for installation
- `google-adk >= 1.16.0` required for HITL; `>= 1.22.0` for `RunConfig.custom_metadata`
