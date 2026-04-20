# Operator Runbook — Startup in a Box

Single source of truth for running the live demo.

## Pre-flight Checklist

Run the automated check first:

```bash
./scripts/preflight.sh
```

Manual verification:

- [ ] **API keys set**: `orchestrator/.env` has `GOOGLE_API_KEY` and/or `OPENROUTER_API_KEY`; `factory/.env` has `ANTHROPIC_API_KEY`
- [ ] **Ports free**: 8000 (orchestrator), 8888 (factory), 3000 (frontend)
- [ ] **Session dir clean**: no leftover `factory/.claude/` or `factory/workspace/` from previous runs
- [ ] **Python 3.11**: `python3 --version` shows 3.11.x (both backends pin `>=3.11,<3.12`)
- [ ] **Node 20**: `node --version` shows v20.x
- [ ] **Lock files present**: `orchestrator/uv.lock`, `factory/uv.lock`, `frontend/package-lock.json`
- [ ] **`uv` installed**: both Python services run under `uv`
- [ ] **`gh` + `vercel` CLIs on PATH**: needed by the devops subagent
- [ ] **Deep health check passes**: both `/health?deep=true` return `{"ok": true, "llm_reachable": true}` after boot

## Boot Sequence

**Order matters**: factory first, orchestrator second, frontend last.

The orchestrator's health check verifies the factory is reachable, so the factory must be up before the orchestrator boots.

The easy path is `make demo` (premium models) or `make dev` (local/OpenRouter defaults) — both boot all three services in the right order. What follows is the manual breakdown.

### 1. Reset (clean state)

```bash
./scripts/reset-demo.sh
```

### 2. Start factory (port 8888)

```bash
cd factory
LOG_JSONL=1 uv run uvicorn factory.server:create_app --factory --host 0.0.0.0 --port 8888
```

Verify: `curl http://localhost:8888/health` returns `{"ok":true}`

### 3. Start orchestrator (port 8000)

```bash
cd orchestrator
LOG_JSONL=1 uv run uvicorn orchestrator.server:create_app --factory --host 0.0.0.0 --port 8000
```

Verify: `curl http://localhost:8000/health` returns `{"ok":true}`

### 4. Start frontend (port 3000)

```bash
cd frontend
npm run dev          # next dev
```

Verify: open `http://localhost:3000` in a browser. The app is a single Next.js 16 route that renders both Boardroom and Factory views internally via `ScreenTabs` — there are no separate `/boardroom.html` / `/factory.html` pages.

### 5. Deep health check

```bash
curl http://localhost:8000/health?deep=true
curl http://localhost:8888/health?deep=true
```

Both must return `{"ok":true,"llm_reachable":true}`.

## Dual-Monitor Stage Setup

### Layout

The frontend is one SPA. For the dual-screen stage, open two browser windows pointing at the same URL and use the in-app `ScreenTabs` control to pin Boardroom on one and Factory on the other.

| Screen | URL | Content |
|--------|-----|---------|
| Screen 1 (left) | `http://localhost:3000` → Boardroom tab | Orchestrator strategy board |
| Screen 2 (right) | `http://localhost:3000` → Factory tab | Agent-flow + Run panel |

Both windows share state via the same backend SSE streams — they'll animate the handoff in sync even though they're independent browser processes.

### Bezel alignment

For the scroll illusion (handoff animation crossing screens), align the browser windows so their content areas share a virtual edge at the bezel. Use full-screen (F11) on both browsers.

- Measure the bezel width between monitors
- For non-adjacent screens: the animation still works, but skip the scroll illusion. The handoff state-machine transitions are the important part.

### Fallback for non-adjacent screens

If screens are not physically adjacent (e.g., presenting via projector):

1. Run one browser window on Boardroom, one on Factory, side by side on the same display
2. The handoff animation degrades gracefully — stages still transition, just no physical scroll illusion
3. Focus audience attention on Screen 2 when `handoff_stage` becomes `"launched"`

### Venue template

Fill in before each demo:

```
Venue:         _______________
Date:          _______________
Screen 1:      _______________ (model, resolution)
Screen 2:      _______________ (model, resolution)
Bezel width:   _____ mm
Screens adjacent: yes / no
Network:       _______________
Backup hotspot: _______________
```

## Recovery Procedures

### Beat 1 hang (preparing -> launched takes too long)

**Symptom**: Boardroom shows "preparing" state for more than 5 seconds.

**Cause**: orchestrator's `handoff_beat1_duration_seconds` sleep is running, or the factory connection failed silently.

**Recovery**:
1. Check factory terminal for errors
2. Check `curl http://localhost:8888/health`
3. If factory is down: restart factory, then reset-demo and retry
4. If factory is up but orchestrator hung: check `logs/<thread_id>/`

### HITL panel never closes

**Symptom**: The approval modal on the Boardroom stays visible past its 6-second auto-approve window.

**Cause**: the `/api/hitl` POST never reached the orchestrator — usually because the frontend proxy is pointed at the wrong port, or the orchestrator crashed while the gate was open.

**Recovery**:
1. Check orchestrator terminal — if it's dead, reset and retry
2. Click **Approve** manually; the handler is idempotent
3. If the modal state is truly stuck, reload the page. The orchestrator future eventually times out after `hitl_timeout_seconds` (default 3 days — effectively the run just ends when you give up), so recovery is reload-and-relaunch, not fiddle-with-the-backend

### Factory stream drop

**Symptom**: Factory screen stops updating mid-build. Orchestrator shows no progress.

**Cause**: factory process crashed or network interruption.

**Recovery**:
1. Check factory terminal — look for stack traces
2. If process died: `./scripts/reset-demo.sh` and restart full stack
3. If network blip: orchestrator will timeout after `factory_idle_timeout_seconds` (default 7200s / 2h) and emit `FactoryTimeoutError`
4. For faster recovery: kill orchestrator, reset, restart

### General: full reset

When in doubt:

```bash
./scripts/reset-demo.sh
# Then follow Boot Sequence above
```

## Forensic Logs

When `LOG_JSONL=1` is set (recommended for all demos), both backends write every AG-UI event to per-run directories bucketed by `thread_id`:

```
logs/<thread_id>/orchestrator.jsonl
logs/<thread_id>/factory.jsonl
logs/<thread_id>/adk.jsonl
logs/<thread_id>/agent-flow.jsonl
logs/_startup/…        # pre-run boot logs
logs/_idle/…           # between-run idle logs
```

Use the `interpret-logs` skill (or `./scripts/interpret-logs.py <thread_id>`) to reconstruct a run end-to-end.

To tail live:

```bash
tail -f logs/*/factory.jsonl
tail -f logs/*/orchestrator.jsonl
```

## Known Issues

### Session cleanup

Factory session state (`factory/.claude/`, `factory/workspace/`) must be cleaned between demo runs. The `reset-demo.sh` script handles this. Running a second demo without reset may produce stale file state.

### Single concurrent run

The architecture assumes one concurrent demo run at a time. Do not start a second prompt while the first is still running — the handoff choreographer is single-consumer per thread.

### Python version

Both backends require Python 3.11 exactly (`>=3.11,<3.12` in pyproject.toml). Python 3.12+ is not supported due to ADK / `ag-ui-adk` dependency constraints.

### OpenRouter vs native Gemini

The orchestrator defaults to OpenRouter (`openrouter/google/gemini-2.5-*`) via LiteLLM. To switch back to native google-genai, flip the model name in `.env` (e.g., `CEO_MODEL=gemini-3.1-pro-preview`) — `_model.build_model` routes based on the prefix, no code change required.
