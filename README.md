# Startup in a Box 🦄

> You type a genuinely stupid idea. Two different agent frameworks conspire. A real Next.js app ships to a real Vercel URL. Live. On stage.

This is the repo behind a **2026 talk** on building agentic systems with **Google ADK** and the **Claude Agent SDK** — used together, because separately they each look like they can do everything, and together they *actually* can.

If you came looking for a tidy hello-world: wrong door. If you want to watch two frameworks stop fighting and start dating in public, come in.

---

## The one-paragraph pitch

One screen is a **boardroom** (ADK): a CEO agent runs seven specialists around a table and produces a typed Lean Canvas + a BuildPlan. The other screen is a **factory** (Claude Agent SDK): a supervisor delegates to five subagents and doesn't stop until the devops agent deploys to Vercel. In between, one typed POST. That's the whole trick.

![system architecture](./docs/diagrams/01-system-architecture.svg)

---

## Why two frameworks?

Because they're good at different things and pretending otherwise is how you end up with 4,000 lines of glue code and a Notion page full of regrets.

| | **Google ADK** | **Claude Agent SDK** |
|---|---|---|
| Best at | High-level reasoning with *typed* artifacts | Real filesystem / shell work in a loop |
| Shape | `LlmAgent` + `AgentTool(child)` coordinator pattern | `ClaudeSDKClient` + subagent dict + plugins + hooks |
| Models | Gemini first, LiteLLM for everyone else | Claude (Haiku/Sonnet/Opus), or anything Messages-API compatible |
| Shipped with | `google-adk`, `ag-ui-adk` | `claude-agent-sdk` + vendored [caveman](https://github.com/juliusbrusee/caveman) compression plugin |
| Role in this demo | **Plans** (boardroom) | **Builds** (factory) |

![framework comparison](./docs/diagrams/06-framework-comparison.svg)

The handoff is a single typed FunctionTool call (`start_factory`) that POSTs a validated Pydantic `BuildPlan` + `LeanCanvas` + `Brand` to the factory's `/factory` SSE endpoint. No magic. No shared state server. No Redis. No “event bus.” A POST.

---

## What you'll see on stage

![pipeline sequence](./docs/diagrams/02-pipeline-sequence.svg)

1. **User types something dumb.** *Uber for crossing the street.* *Tinder for sourdough starters.* *LinkedIn for toddlers.*
2. **Boardroom activates.** Theo the CEO talks trash, delegates to specialists, collects their JSON, seals a Lean Canvas, ships a BuildPlan. The market analyst secretly delegates to its own `market_researcher` sub-agent so Gemini can run Google search *and* emit a typed artifact — a constraint you hit the moment you mix built-in tools with `output_schema`.
3. **HITL gate.** The Boardroom pauses on the sealed plan with a 6-second visible countdown. Anyone can cancel/approve/reject. Silence = ship it — live-demo affordance, not a security model.
4. **Handoff cinematic.** A scroll sprite literally flies from one PixiJS stage to the other. (Yes, it's silly. Yes, it makes the architecture click for the audience instantly.)
5. **Factory roars.** The supervisor delegates step by step: architect → implementer → tester → devops. Skills guide mocked-first behavior. Hooks block `rm -rf /` and rewrite Bash into token-friendly form. The progress bar ticks each time a subagent's `tool_result` comes back, so it tracks completion, not dispatch.
6. **Deploy.** `git init` → `gh repo create` → `vercel --prod` → a live URL the audience can open on their phones.


---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Docker | 24+ | **Recommended path.** Compose runs everything in containers. |
| Python | 3.11.x | **Not 3.12.** ADK is picky. Only needed for native dev (Option B). |
| Node | 22.x+ | Only needed for native dev (Option B). |
| [`uv`](https://docs.astral.sh/uv/) | latest | Both Python services run under `uv`. Only needed for Option B. |
| [`gh`](https://cli.github.com/) | latest | Needed by the devops subagent to create repos. |
| `npx vercel` | latest | Comes via `npx`; you just need the token. |
| [`rtk`](https://github.com/rtk-ai/rtk) (optional) | 0.23+ | `brew install rtk`. Cuts 60–90% of Bash output tokens. Skipped if absent. |

---

## Quick start

#### Option A — Docker Compose (recommended)

Three isolated containers — your API keys, tokens, and the agent runtime stay sandboxed away from your host machine. The factory's Claude Agent SDK session gets full shell access inside its container; Docker Compose ensures that access can't escape to your local filesystem, processes, or network.

```bash
# 1. set env
cp factory/.env.example factory/.env && $EDITOR factory/.env
cp orchestrator/.env.example orchestrator/.env && $EDITOR orchestrator/.env

# 2. override host ports if the defaults (3000/8000/8888) clash
cp .env.docker.example .env && $EDITOR .env

# 3. build & run
make compose-demo

# pin every model to flash-lite / haiku (~75% cheaper, good for testing)
make compose-demo CHEAP=1

# tail / stop
make compose-logs
make compose-down
```

> **Why Docker?** The factory runs a Claude Agent SDK session with `acceptEdits` permission mode — it can read, write, and execute shell commands inside its workspace. In Docker, that workspace is an isolated container filesystem. Running natively (Option B) means the agent operates directly on your machine. The quality hooks (`pre_bash_guard`) block destructive commands like `rm -rf /` and `sudo`, but containers are a stronger boundary.

#### Option B — native dev servers

If you prefer hot reload and faster iteration:

```bash
# 1. install
make install

# 2. set env
cp factory/.env.example factory/.env && $EDITOR factory/.env
cp orchestrator/.env.example orchestrator/.env && $EDITOR orchestrator/.env

# 3. run
make dev                                    # default (OpenRouter models)
make dev-cheap                              # flash-lite + haiku (~75% cheaper)
make demo                                   # premium (Gemini Pro + Opus)
make dev-auto IDEA="Uber but only for pigeons"  # auto-submit an idea
```

Then open http://localhost:3000 and watch the boardroom light up.

### Environment variables

Everything routes through **OpenRouter** by default — one API key covers both services.

**`orchestrator/.env`** — the ADK side:
```bash
OPENROUTER_API_KEY=sk-or-...
ORCHESTRATOR_MODEL=openrouter/google/gemini-2.5-flash
CEO_MODEL=openrouter/google/gemini-2.5-flash
CTO_MODEL=openrouter/google/gemini-2.5-pro
```

**`factory/.env`** — the Claude side:
```bash
ANTHROPIC_API_KEY=sk-or-...                          # same OpenRouter key
ANTHROPIC_BASE_URL=https://openrouter.ai/api/v1      # route through OpenRouter
FACTORY_MODEL=anthropic/claude-opus-4.7      # subagents pin their own tier in subagents.py
```

Model names use the **OpenRouter format** (`anthropic/<model>`). If you switch to the native Anthropic API (`sk-ant-...` key, blank `ANTHROPIC_BASE_URL`), drop the prefix and use dated IDs:

| OpenRouter (recommended)       | Native Anthropic API            |
|--------------------------------|---------------------------------|
| `anthropic/claude-opus-4.7`    | `claude-opus-4-7-20250219`      |
| `anthropic/claude-haiku-4.5`   | `claude-haiku-4-5-20251001`     |

For full details see the `.env.example` files in each service. Everything not `*_API_KEY`-shaped has sensible defaults — check `settings.py` for the full list.

### Deploy credentials (optional)

The factory builds sites locally by default. To also push to GitHub and deploy to Vercel, set these in `factory/.env`:

```bash
GITHUB_TOKEN=ghp_...               # github.com/settings/tokens (repo + delete_repo)
VERCEL_TOKEN=...                   # vercel.com/account/tokens
```

Without these tokens the factory still runs the full build — the output lives in `factory/workspace/<thread_id>/`. With them, the devops subagent pushes to GitHub and deploys to Vercel automatically.

> **No `vercel login` needed.** The factory passes `--token $VERCEL_TOKEN --yes` to every `vercel` invocation, bypassing interactive/device-code auth entirely.

---

## Architecture, in three slides' worth of diagrams

### The boardroom cast (ADK side)

![boardroom cast](./docs/diagrams/09-boardroom-cast.svg)

Each specialist is an `AgentTool` on the CEO — **not** a `sub_agent`. The distinction matters (see the ADK doc below); `sub_agents` with `output_schema` can't transfer control back, so you end up with dead-end children. AgentTool keeps the CEO in the driver's seat on every turn.

### The delegator pattern

![ADK delegator pattern](./docs/diagrams/03-adk-delegator-pattern.svg)

### The Lean Canvas funnel

![lean canvas flow](./docs/diagrams/07-lean-canvas-flow.svg)

The four upstream specialists write to `session.state` via `output_key`. The strategist (Yara) reads all four and seals the 9-block canvas. The CTO reads **only the canvas** — not the raw artifacts — so downstream decisions track a single sealed source of truth. The factory's Claude prompt quotes it verbatim.

### The factory loop (Claude SDK side)

![Claude SDK loop](./docs/diagrams/04-claude-sdk-loop.svg)

The supervisor delegates each BuildPlan step to the right subagent. Claude reads the workspace + git state before acting, so it picks up where the previous step left off. The run succeeds when the devops subagent prints a live Vercel URL.

### The handoff state machine

![handoff states](./docs/diagrams/05-handoff-state-machine.svg)

### AG-UI: one protocol, two backends

![AG-UI events](./docs/diagrams/08-ag-ui-event-map.svg)

Both services speak [AG-UI Protocol](https://github.com/ag-ui-protocol/ag-ui) over SSE. The frontend has **one** event reducer (`useAgUiEvents`) — it doesn't care whether the packet came from ADK or Claude. That's the whole point.

### Where things run

![dev stack](./docs/diagrams/10-dev-stack.svg)

---

## What's in each module?

### `orchestrator/` — the Boardroom (Google ADK)

```
orchestrator/src/orchestrator/
  agents/
    ceo.py              Theo — the LlmAgent coordinator
    data_structurer.py  Idea → StrategyBoard
    market_analyst.py   parent analyst + market_researcher child (GoogleSearch), emits MarketAnalysis
    brand_designer.py   Juno — Brand
    business_planner.py → BusinessPlan
    strategist.py       Yara — reconciles into the LeanCanvas
    cto.py              Sam — emits the BuildPlan
    reviewer.py         Verdict + notes
  artifacts/            Pydantic models (ground truth)
  tools/
    start_factory_tool.py   Typed FunctionTool — the handoff
    send_back_tool.py       Revision counter
  pipeline_stream.py    ADK event stream → AG-UI SSE
  server.py             FastAPI + ag-ui-adk
```

### `factory/` — the Factory (Claude Agent SDK)

```
factory/src/factory/
  runner.py             ClaudeSDKClient + plugins + hooks, drives the BuildPlan
  subagents.py          5 AgentDefinitions: architect, implementer, tester, devops, build_reviewer
  quality_hooks.py      pre_bash_guard · rtk_rewrite · post_write_lint
  stream.py             AG-UI SSE encoder + ProgressTracker
  server.py             FastAPI endpoint
  validation.py         BuildPlan Pydantic model (matches the orchestrator's)
factory/skills/         Dual-path skills — symlinked into each workspace's .claude/skills/
  stripe-checkout/      Mock → real Stripe when STRIPE_SECRET_KEY is set
  vercel-neon/          In-memory → Neon Postgres when DATABASE_URL is set
  external-apis/        Hand-written → real provider when the relevant key is set
factory/vendor/
  caveman/              ~75% token-compression plugin
```

### `frontend/` — the Stage (Next.js 16 + PixiJS + CopilotKit)

```
frontend/src/
  app/                  App Router, /api/copilotkit proxy, /api/ag-ui-log
  components/
    ClientApp.tsx       Root shell
    BoardroomScreen.tsx PixiJS boardroom with Theo & crew
    FactoryScreen.tsx   Mounts embedded agent-flow graph
    LeanCanvasManuscript.tsx  The illuminated 9-block parchment
    ApprovalCard.tsx    HITL
    ExecutionTimeline.tsx · ArtifactRail · AppStatusCluster · UnicornTransition
  hooks/
    useAgUiEvents.ts        Single reducer for both backends
    useHandoffAnimation.ts  The scroll cinematic
  pixi/                   Characters, tilemaps, sprite sheets (forked from ai-town)
```

---

## The skills system (dual-path is the whole game)

Every factory skill follows the same contract: **build and run with zero env vars**, producing a convincing mock. Add the right env var → the site silently flips to the real provider. No code change.

| Skill | Default (zero env) | Upgraded by |
|-------|-------------------|-------------|
| `stripe-checkout` | Mock checkout page, test card hint | `STRIPE_SECRET_KEY` |
| `vercel-neon` | In-memory store in `lib/db.ts` | `DATABASE_URL` (auto-injected by Vercel Neon integration) |
| `external-apis` | Hand-written canned responses | `AI_GATEWAY_API_KEY`, `OPENAI_API_KEY`, `RESEND_API_KEY`, ... |

This is why *every* generated site ships, even when you forget a key. It's also why the factory doesn't hang on third-party network calls during a live demo. And it's why the `.env.example` of each generated repo doubles as the upgrade manual.

---

## Running tests

```bash
make test                # everything
make test-orchestrator   # pytest — ~70 tests
make test-factory        # pytest
```

---

## The quality hooks (Claude SDK side)

Three Python callbacks wired into `ClaudeAgentOptions.hooks`:

| Hook | Event | What it does |
|------|-------|--------------|
| `pre_bash_guard` | `PreToolUse` (Bash) | Denies `rm -rf /`, `git push --force`, `git reset --hard`, `--no-verify`, `sudo`, fork bombs. Returns a `permissionDecision: "deny"` with a reason — the agent reacts, not crashes. |
| `rtk_rewrite` | `PreToolUse` (Bash) | If `rtk` is on PATH, delegates to `rtk rewrite <cmd>` and returns `updatedInput` with the token-compressed equivalent. No-op when missing. |
| `post_write_lint` | `PostToolUse` (Write/Edit) | Scans new `.ts/.tsx/.js/.jsx` for `console.log`, bare `any`, unjustified `@ts-ignore`, stray `debugger`, empty files. Pushes findings back via `additionalContext` so the *next* turn fixes them. |

This is the Claude SDK equivalent of "guardrails" — except they're not vibes, they're return values with enforced semantics.

---

## The vendored plugins (Claude SDK side)

The factory's Claude session runs **isolated** (`setting_sources=[]`) — it does not inherit your dev machine's Claude Code plugins. Instead:

- **`factory/vendor/caveman/`** — ultra-compressed agent output via `SessionStart` + `UserPromptSubmit` hooks (~75% token cut).

Adding a new vendored plugin = drop a clone or submodule under `factory/vendor/<name>/` and append it to the `vendored_plugins` list in `runner.py`. Missing vendors degrade with a warning, not a crash.

---

## Run accounting in the UI

Every factory run accumulates `total_cost_usd`, input/output/cache tokens, `num_turns`, and `duration_ms` from each `ResultMessage` and emits them as AG-UI `STATE_DELTA`. The frontend renders:

- A **cost chip** in the header (`AppStatusCluster`) that updates live.
- A **Run** panel inside the Deploy artifact showing cost, turns, duration, token counts side-by-side with the deployment + repo URLs.

SDK errors branch into typed handlers (`CLINotFoundError`, `CLIConnectionError`, `ProcessError`, `CLIJSONDecodeError`, `ClaudeSDKError`, `asyncio.CancelledError`) — so the UI shows a specific reason, not a generic 500. CLI stderr is also piped live as `cli_stderr_line` deltas.

---

## Debug grid overlay

Press **`G`** in the browser to toggle the boardroom debug overlay. While active you can:

1. **Relocate characters** — click a yellow station dot (turns magenta when selected), then click any walkable tile.
2. **Change facing** — with a character selected, press arrow keys to set idle direction.
3. **Toggle walkability** — with nothing selected, click a tile to block/unblock it (red = blocked, green hatching = unblocked).

Edits are live — pathfinding and handoff animations respect them immediately. The companion **Overrides Panel** (HTML) exports your changes as a copy-pasteable snippet you can commit back to the canonical layout data.

> The hotkey is ignored when focus is in an input, textarea, or contentEditable element.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|------|
| `Port 8000/8888/3000 in use` | Leftover dev server | `make kill-ports` |
| `Google search tool is not supported` | Non-Gemini model + real search tool | Expected. The orchestrator falls back to a stub automatically. |
| Factory hangs at "power on" | Missing `ANTHROPIC_API_KEY` or wrong base URL | Check `factory/.env`; the CLI stderr is piped live as `cli_stderr_line` — look in the Factory panel. |
| "Credit balance is too low" | Anthropic billing | Top up. The agents do not work pro bono. |
| Orchestrator timeouts | Small local model | Use `make demo` or a 30B+ model. Flash-Lite also works if paired with Pro for CEO/CTO. |
| Generated site builds but `/api/foo` returns mocks | Normal | Set the matching env var in the deployed project — the `.env.example` at the repo root lists every option. |

---

## Further reading

- [`docs/architecture.md`](docs/architecture.md) — the deep architecture doc
- [`docs/diagrams.md`](docs/diagrams.md) — every diagram in one page
- [`docs/runbook.md`](docs/runbook.md) — dual-screen stage setup + recovery procedures

---

## Author

**Martin Brian** — Senior AI Engineer

- [LinkedIn](https://www.linkedin.com/in/martinbrianmdbn/)

---

## Credits & license

Licensed under [MIT](LICENSE). Full third-party attribution in [`NOTICE.md`](NOTICE.md).

- **Pixel art stage** — forked from [`a16z-infra/ai-town`](https://github.com/a16z-infra/ai-town) (MIT). Convex parts gutted, AG-UI reducer grafted on top.
- **Tilesets** — [Cool School](https://opengameart.org/content/cool-school-tileset) (CC0), ai-town sprites (MIT). Per-asset licenses in [`frontend/public/assets/LICENSES.md`](frontend/public/assets/LICENSES.md).
- **Agent-flow** — vendored from [`patoles/agent-flow`](https://github.com/patoles/agent-flow) (Apache 2.0). Factory node-graph visualizer.
- **Plugins** — [caveman](https://github.com/juliusbrusee/caveman) (MIT).

**The tileset story:** The boardroom started with [LimeZu's Modern Interiors](https://limezu.itch.io/) tileset. We built a web-based tile-authoring tool to compose rooms from individual tiles, but the workflow was too brittle for live-demo reliability. We switched to single pre-rendered background images. The tileset is not redistributable, so it and the authoring tool have been removed from this public release.

Go build something stupid. The frameworks can take it.
