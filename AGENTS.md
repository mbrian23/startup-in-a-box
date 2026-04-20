# AGENTS.md — Startup in a Box

## What this is

An autonomous agent swarm that takes a one-sentence startup idea, debates it in a virtual boardroom, and builds + deploys the product — all streamed live to a PixiJS stage.

Two AI frameworks split the work by strength:

| Layer | Framework | Why |
|---|---|---|
| **Orchestrator** (planning) | Google ADK + Gemini | Typed agent graphs, structured output, live web search |
| **Factory** (building) | Claude Agent SDK + Claude | Filesystem, shell, multi-file code generation |

They talk over **AG-UI protocol** (SSE), and the **Next.js 16 frontend** renders the whole thing as an animated boardroom → factory handoff.

## Repository layout

```
orchestrator/          ADK planning engine          (Python, FastAPI, port 8000)
factory/               Claude Agent SDK builder     (Python, FastAPI, port 8888)
frontend/              Next.js 16 + PixiJS UI       (React 19, port 3000)
web/                   Presentation deck            (Next.js, port 7833)
docs/                  Architecture + runbook + Mermaid diagrams
scripts/               Operational helpers (dev-auto, reset-demo, preflight)
logs/                  JSONL event stream storage
.claude/skills/        Skills vendored for factory sessions
```

## Orchestrator — the boardroom

**Path:** `orchestrator/src/orchestrator/`

The CEO agent (`agents/ceo.py`) coordinates seven specialists via `AgentTool` — each runs and returns control to the CEO (not `transfer_to_agent`, which would be a dead-end).

### Agent roster

| Agent | Role | Output artifact | Model tier |
|---|---|---|---|
| `ceo` | Coordinator — calls specialists, gates handoff | — | CEO_MODEL |
| `strategist` | Seals the LeanCanvas (ground truth for everything downstream) | `lean_canvas` | ORCHESTRATOR_MODEL |
| `market_analyst` | Structures market research via child `market_researcher` | `market_analysis` | ORCHESTRATOR_MODEL |
| `brand_designer` | Name, tagline, palette, logo prompt | `brand` | ORCHESTRATOR_MODEL |
| `business_planner` | Revenue model, GTM, milestones | `business_plan` | ORCHESTRATOR_MODEL |
| `reviewer` | Final quality gate before build | `plan_review` | ORCHESTRATOR_MODEL |
| `cto` | Translates canvas into a BuildPlan the factory can execute | `build_plan` | CTO_MODEL |

### Key patterns

- **`output_key`** on each specialist auto-emits `STATE_DELTA` via `ag-ui-adk` — no manual event wiring.
- **`session.state`** is the inter-agent bus. No HTTP calls between specialists.
- **LeanCanvas is ground truth.** CTO reads only the canvas. Factory instruction: "if canvas and build plan disagree, canvas wins."
- **Model routing** (`agents/_model.py`): prefix determines transport — `gemini-*` → google-genai native, `openrouter/...` → LiteLLM. Just change the env var.
- **Gemini quirk:** can't combine `output_schema` + `google_search` on the same agent. Workaround: `market_researcher` (tools, no schema) is called by `market_analyst` (schema, no tools) as an AgentTool.

### Tools

| Tool | What it does |
|---|---|
| `start_factory` | Terminal action: POSTs BuildPlan + LeanCanvas + Brand to factory |
| `send_back` | Revision loop: CEO can send plan back for refinement |
| `handoff` | Orchestrates the HITL approval gate |

### HITL gate

The boardroom pauses after CEO calls `start_factory`. Frontend shows a 6-second countdown modal. POST to `/api/hitl` resolves an `asyncio.Future`. No server-side timeout — UI auto-approves in demo mode.

## Factory — the build floor

**Path:** `factory/src/factory/`

The factory receives a BuildPlan and spins up a Claude Agent SDK session with a supervisor that delegates every step to typed subagents via the `Agent` tool.

### Subagent roster

| Subagent | Tools | Model tier | Role |
|---|---|---|---|
| `architect` | Read, Write, Glob, Grep | opus | Designs CLAUDE.md + project layout |
| `implementer` | Read, Write, Edit, Glob, Grep, Bash | sonnet | Writes application code |
| `tester` | Read, Grep, Glob, Bash | haiku | Runs type checks, build, lint |
| `devops` | Read, Write, Edit, Bash | haiku | git init → gh repo create → vercel deploy |
| `build_reviewer` | Read, Grep, Glob | sonnet | Code review before final ship |

Model tiers spread rate-limit pressure across all three Anthropic buckets. Configured in `subagents.py`.

### Quality hooks (`quality_hooks.py`)

1. **`pre_bash_guard`** — blocks `rm -rf /`, `git push --force`, `--no-verify`, `sudo`, fork bombs
2. **`rtk_rewrite`** — if `rtk` CLI is on PATH, compresses `git status` / build output 60–90%
3. **`post_write_lint`** — scans TS/JS for `console.log`, bare `any`, `@ts-ignore`, `debugger`

### Skills (dual-path, mock-first)

Skills live in `factory/skills/` and follow a strict contract: zero env vars → convincing mock, set the right key → real provider, no code change.

| Skill | Mock mode | Real mode |
|---|---|---|
| `stripe-checkout` | Fake checkout page | `STRIPE_SECRET_KEY` |
| `vercel-neon` | In-memory store | `DATABASE_URL` (Neon Postgres) |
| `external-apis` | Canned responses | Per-provider API keys |

### Session isolation

- `setting_sources=[]` — no dev config leaks into factory runs
- Each run gets `factory/workspace/<thread_id>/`
- `.claude/` is created fresh per run

## Frontend — the stage

**Path:** `frontend/src/`

### Architecture

- **Single event source, single reducer:** `useAgUiEvents.ts` consumes AG-UI SSE from both backends, merges into a shared `BoardState` tree.
- **PixiJS layer** (`pixi/`) renders animated characters, the boardroom, and the factory floor. GL context is shared across screens via `SharedPixiShell` so it survives tab swaps.
- **React layer** renders artifact panels (Strategy / Market / Canvas / Build / Progress / Files / Deploy) as overlays on top of the stage.
- **AG-UI bridge** (`lib/agent-flow-bridge.ts`) — thin SSE pass-through from factory transcript to the agent-flow node-graph visualizer.

### Key state shape (`ag-ui/types.ts`)

`BoardState` includes: `active_agent`, `handoff_stage`, `lean_canvas`, `cost_usd`, `usage`, `num_turns`, `deployment_url`, `github_url`, `hitl`.

Events are a discriminated union: `RUN_STARTED`, `TEXT_MESSAGE_*`, `TOOL_CALL_*`, `STATE_DELTA`, `STATE_SNAPSHOT`, `RUN_FINISHED`, `RUN_ERROR`.

## End-to-end flow

```
User types idea → IdeaLauncher POSTs to /api/orchestrator
  → CEO calls specialists sequentially (each writes to session.state)
  → STATE_DELTA events stream to frontend (boardroom animates)
  → CEO calls start_factory → HITL gate → user approves
  → Orchestrator POSTs BuildPlan to factory
  → Factory supervisor delegates to subagents (architect → implementer → tester → devops)
  → Factory SSE streams back through orchestrator connection
  → Frontend switches to factory tab, renders agent-flow graph
  → devops deploys → deployment_url appears → run complete
```

## Model configuration

All models are configured via env vars. No code changes needed to swap providers.

### Orchestrator (`orchestrator/.env`)

```bash
OPENROUTER_API_KEY=sk-or-...
ORCHESTRATOR_MODEL=openrouter/google/gemini-2.5-flash
CEO_MODEL=openrouter/google/gemini-2.5-flash
CTO_MODEL=openrouter/google/gemini-2.5-pro
```

### Factory (`factory/.env`)

```bash
ANTHROPIC_API_KEY=sk-or-...
ANTHROPIC_BASE_URL=https://openrouter.ai/api/v1
FACTORY_MODEL=anthropic/claude-opus-4.7
```

Model names use the **OpenRouter format** (`anthropic/<model>`). If switching to native Anthropic API (`sk-ant-...` key, blank `ANTHROPIC_BASE_URL`), drop the prefix:

| OpenRouter (recommended) | Native Anthropic API |
|---|---|
| `anthropic/claude-opus-4.7` | `claude-opus-4-7-20250219` |
| `anthropic/claude-haiku-4.5` | `claude-haiku-4-5-20251001` |

## Build & run commands

```bash
make install              # uv sync (orchestrator + factory) + npm install (frontend + deck)
make dev                  # all four services with hot reload (Ctrl-C stops all)
make dev-cheap            # flash-lite + haiku everywhere (~75% cost savings)
make dev-auto IDEA="..."  # boots stack + auto-submits an idea end-to-end
make demo                 # production builds, no hot reload
make kill-ports           # free 8000/8888/3000/7833
```

Boot order matters: **factory first, orchestrator second, frontend last.** `make dev` handles this.

### Individual services

```bash
make dev-orchestrator     # just orchestrator on :8000
make dev-factory          # just factory on :8888
make dev-frontend         # just frontend on :3000
```

### Tests

```bash
make test                 # all suites (orchestrator + factory + frontend)
make test-orchestrator    # cd orchestrator && uv run pytest
make test-factory         # cd factory && uv run pytest (exits 0 if no tests collected)
make test-frontend        # cd frontend && npm test (vitest)

# single Python test
cd orchestrator && uv run pytest tests/test_pipeline.py -k "test_name"

# single frontend test
cd frontend && npx vitest tests/pixi/use-spatial-bridge.test.ts
```

Both Python services use `asyncio_mode = "auto"` and `testpaths = ["tests"]`.

### Lint

```bash
make lint                 # eslint frontend
cd frontend && npm run build   # type-checks via Next.js build
```

### Docker

```bash
make docker               # build + run all-in-one container
make compose-demo         # three-service stack + deck (pass CHEAP=1 for budget models)
make compose-down         # tear down
```

### Pre-demo checklist

Run `./scripts/preflight.sh` — verifies API keys, ports, Python/Node versions, lock files, CLI presence, and deep health checks.

Pre-warm both services before going on stage:
```bash
curl localhost:8000/health?deep=true
curl localhost:8888/health?deep=true
```

## Conventions

- **Package manager:** `uv` for Python, `npm` for JS. Never `pip` or `yarn`.
- **Model config is env-var only.** Prefix determines transport: `openrouter/...` → LiteLLM, `gemini-*` → google-genai native. No code changes to swap.
- **LeanCanvas is ground truth.** If canvas and build plan disagree, canvas wins. CTO reads only the canvas.
- **AgentTool, not transfer.** Orchestrator specialists return control to the CEO. `transfer_to_agent` + `output_schema` = irreversible dead-end.
- **Factory skills are dual-path:** zero env vars → mock, set the key → real provider. No code branching.
- **Spatial data** (collision maps, station positions) goes in hand-authored ASCII floor-plan files (like `boardroom-collision.ts`), not coordinate arrays.

## Gotchas

1. **CORS must match.** Both orchestrator and factory hardcode `CORS_ORIGINS=["http://localhost:3000"]`. If the frontend port changes, update both `.env` files.
2. **Typed factory errors.** `CLINotFoundError`, `CLIConnectionError`, `ProcessError`, `CLIJSONDecodeError` — each maps to a specific `RUN_ERROR` message. No catch-all.
3. **Workspace cleanup.** Pass a fresh `thread_id` between runs or `rm -rf factory/workspace/*`. State doesn't leak.
4. **rtk is optional.** If the `rtk` CLI isn't on PATH, factory still works — just noisier Bash output.
5. **`function_calling_config.mode = ANY`** in the CEO forces Gemini to emit tool calls instead of prose. Without it, the model sometimes narrates instead of acting.
6. **Gemini quirk** with `output_schema` + `google_search` — see the market_analyst pattern in the Orchestrator section above.
