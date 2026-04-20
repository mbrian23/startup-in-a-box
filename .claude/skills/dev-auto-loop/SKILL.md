---
name: dev-auto-loop
description: Boots the full Startup-in-a-Box dev stack (orchestrator + factory + frontend) AND auto-submits a startup idea so the pipeline runs end-to-end without a human clicking in the UI. Use whenever the user asks to "run the full pipeline", "try an idea", "check the results automatically", "close the loop", "smoke test with idea X", "see what the agents do with this idea", or wants a one-shot way to exercise orchestrator→factory→frontend and inspect the output. Triggers even when the user doesn't say "dev-auto" — if they want to kick off a run from a terminal with an idea string, this is the skill.
---

# dev-auto loop

One command boots the whole stack and auto-submits an idea so you can watch the pipeline run and then diagnose the result. Use this instead of `make dev` when you want to verify behavior end-to-end without opening a browser to type a prompt.

## The command

```bash
make dev-auto IDEA="Uber for crossing the street"
```

- `IDEA` is required. Quote it. If omitted, the target exits 2 with a usage message and does not start services.
- Boots orchestrator (:8000), factory (:8888), frontend (:3000) — same as `make dev`, with an extra driver process that waits for health, POSTs the idea, and streams events.
- Services stay running after the run completes. Ctrl-C stops the whole stack.

## What happens under the hood

1. Make launches the three servers in parallel AND `scripts/dev-auto.py --idea "..."` as a fourth job.
2. The driver generates a fresh `thread_id` / `run_id` (UUIDs), prints them up front, and polls `:8000/health`, `:8888/health`, TCP on `:3000` for up to 120 s.
3. Once all three are up, it POSTs `RunAgentInput` (see `scripts/e2e-smoke.py:396-410` for the exact payload shape) to `http://localhost:8000/orchestrator` with `Accept: text/event-stream`.
4. It streams SSE frames live, printing a one-liner per event type: `RUN_STARTED`, `TOOL_CALL_START: <name>`, `STATE_DELTA: <paths>`, `TEXT: <snippet>`, `RUN_FINISHED`, `RUN_ERROR: <msg>`.
5. It captures the `/factory_result` and `/factory_error` STATE_DELTA patches (emitted by `orchestrator/src/orchestrator/pipeline_stream.py:184-207`).
6. When `RUN_FINISHED` or `RUN_ERROR` arrives, it prints a summary block: thread_id, run_id, event count, whether it started/finished/errored, the `logs/<thread_id>/` path with the JSONL files present, and a truncated factory-result snapshot.

Every `[auto]`-prefixed line comes from the driver. `[orch]`, `[factory]`, `[web]` are the three servers.

## Exit codes

The driver's exit code is NOT the Make target's exit code (Make exits when `wait` returns, after Ctrl-C). To script on the driver outcome, call the driver directly against an already-running stack — not via `make dev-auto`.

- 0 — `RUN_FINISHED` seen, no `RUN_ERROR`
- 1 — `RUN_ERROR` seen, or stream ended before `RUN_FINISHED`
- 2 — services never became healthy, or HTTP/connection error

## When things go wrong

- **Ports already in use.** `[auto]` hangs on "waiting for services to come up..." while `[orch]`/`[factory]`/`[web]` log address-in-use errors. Run `./scripts/reset-demo.sh` (or `make reset`) to kill the prior processes, then retry.
- **LLM unreachable.** `[auto]` prints `RUN_ERROR` with a validation or connection message. Check LM Studio / the upstream model at `http://127.0.0.1:1234/v1/models`. This is the same failure mode `scripts/e2e-smoke.py` classifies as "Phase 5 LLM failure" (exit 4 there).
- **Stream ends before `RUN_FINISHED`.** Something crashed mid-run. Open `logs/<thread_id>/orchestrator.jsonl` and `factory.jsonl` — use the `interpret-logs` skill to trace.
- **Frontend slow to come up.** The driver probes TCP on :3000 only, not HTTP — Next.js accepts connections before it finishes compiling. If the idea gets submitted and the frontend still isn't compiled, the run still works; you just can't see it in the browser until `[web] ✓ Ready` appears.

## After the run

The summary prints a path like `logs/<thread_id>/`. Inspect it with the `interpret-logs` skill, or quick-look at:

```bash
jq -c 'select(.event.type == "RUN_FINISHED" or .event.type == "RUN_ERROR")' logs/<thread_id>/ag-ui.jsonl
jq -c 'select(.level == "ERROR")' logs/<thread_id>/orchestrator.jsonl
```

The `factory_result` STATE_DELTA contains the final build artifact summary (status, deployment URL if any). It's the clearest "did it work" signal without re-reading the full stream.

## Reusing pieces

- Payload shape: `scripts/e2e-smoke.py:396-410`
- Health helpers: `scripts/e2e-smoke.py:105-115`
- Endpoint contract: `orchestrator/src/orchestrator/server.py:109-144`
- Result emission: `orchestrator/src/orchestrator/pipeline_stream.py:184-216`

## Do not confuse with `scripts/e2e-smoke.py`

`e2e-smoke.py` is a one-shot CI-style test: it boots *its own* orchestrator + factory (no frontend), runs phases, tears everything down, and emits a pass/fail report with a hard-coded idea. Use it for regression checks. Use `make dev-auto` for interactive development where you want the stack to stay up and drive it with your own idea.
