---
name: interpret-logs
description: Reads the Startup-in-a-Box unified JSONL logs (ag-ui, orchestrator, adk, factory) to reconstruct what happened in a run. Use whenever the user asks to "check the logs", "what happened in the last run", "why did the boardroom fail", "diagnose run X", "why didn't the factory start", or anything that requires tracing a pipeline across components. Triggers even when the user doesn't explicitly say "logs" — if they're debugging agent behavior, hand-off gaps, stuck runs, or "no build plan was produced" errors, this is the skill.
---

# Interpret logs

## What this repo's logs look like

Every run of the agent swarm writes into `<repo-root>/logs/<thread_id>/`, with one file per component:

```
logs/
  <thread_id>/
    ag-ui.jsonl        # frontend wire events (RUN_STARTED, TEXT_MESSAGE_*, TOOL_CALL_*, STATE_DELTA, RUN_FINISHED)
    orchestrator.jsonl # CEO coordinator, pipeline_stream, tool shims, delegate logic
    adk.jsonl          # google_adk internals at DEBUG — sub-agent activations, transfer routing, tool dispatch
    factory.jsonl      # factory runner + subagents, only present when a BuildPlan was delegated
  _startup/<boot_id>/  # records emitted before the first run of a process boot
  _idle/<boot_id>/     # records emitted between runs of a process boot
```

Each record is newline-delimited JSON with this shape:

```json
{"ts":"2026-04-14T15:17:09.184Z","level":"INFO","logger":"...","message":"...","boot_id":"...","thread_id":"...","run_id":"..."}
```

ag-ui lines wrap a wire event: `{"ts":"...Z","event":{"type":"TOOL_CALL_START",...},"thread_id":"...","run_id":"..."}`.

`boot_id` identifies which process served the line — a single `<thread_id>/` folder can contain lines from multiple boots if a session was served across restarts. `thread_id` is shared across every component of one run (ag-ui on the frontend, orchestrator on the Python side, factory via HTTP delegation). `run_id` rotates per `POST /orchestrator` invocation inside a thread.

## The workflow

### 1. Locate the run

If the user named a `thread_id` or pointed at a folder, use that. Otherwise default to the newest folder under `logs/` by mtime — that's the last run:

```bash
ls -td <repo-root>/logs/*/ | head -1
```

Skip `_startup/` and `_idle/` when auto-picking — those are out-of-run chatter, not runs.

### 2. Merge the four files chronologically

Every record carries a UTC ISO-8601 `ts` with millisecond precision, so a line-sort gives you a true timeline across components. The repo's `scripts/merge_run.py` does this — call it rather than writing one-off shell pipelines:

```bash
python <skill-dir>/scripts/merge_run.py <logs/thread_id>
```

It emits one line per event with a short prefix showing which file it came from (`ag-ui`, `orch`, `adk`, `fact`) so you can see the hand-offs visually. If you'd rather do it inline, `jq -s 'sort_by(.ts) | .[]'` across the four files works too.

### 3. Read the merged stream with these questions in mind

- **Did the run even start?** Look for `RUN_STARTED` on ag-ui and the matching INFO line in orchestrator.jsonl.
- **Where did the pipeline stall?** Successful boardroom runs walk CEO → data_structurer → market_analyst → brand_designer → business_planner → cto → reviewer → CEO, each producing a `STATE_DELTA` that writes an `output_key` (`strategy_board`, `market_analysis`, `brand`, `business_plan`, `build_plan`, `plan_review`). If the chain stops partway, that's the gap.
- **Did CEO try to hand off?** Look for `TOOL_CALL_START` with `toolName: "transfer_to_agent"` on ag-ui. Then check `adk.jsonl` for the target — ADK logs transfer routing at DEBUG. If the TOOL_CALL pair has no body/args between them and no subsequent specialist activity, the hand-off misfired.
- **Did factory get the BuildPlan?** `orchestrator.jsonl` writes "Planning complete; delegating to factory" when `build_plan` appears in state. If you see `factory_error: "No build plan was produced by the boardroom."` in a STATE_DELTA, the CEO never produced it — don't look inside `factory.jsonl`, it won't exist.
- **Is this a cross-boot trace?** Filter by `boot_id` to separate a restart. If the same `thread_id` spans multiple `boot_id`s in the merged stream, the user reconnected mid-run.

### 4. Tell the story, then the timeline, then the fix

Present findings in this order — diagnosis first, evidence second:

```
## Diagnosis
<1-3 sentences: what happened, where it stopped, why.>

## Timeline
<10-30 most-relevant merged log lines with ts + component + summary. Trim the noise. Highlight the pivot moment.>

## Narrative
<A paragraph reconstructing the run as a sequence of decisions across components — what CEO decided, who they tried to hand off to, what the specialist did or didn't do, how factory responded.>

## Likely fix
<Concrete code pointer. Name the file, function, and what to change. Don't hand-wave. If the root cause isn't nailable from logs alone, say so and name the next thing to check.>
```

Scale each section to the question — a quick "what happened" gets short sections; a deep debug gets more of the timeline.

## Common failure patterns and what they mean

The patterns below are worth pattern-matching against, but don't force-fit. If the logs don't match any of these cleanly, describe what you actually see rather than picking the nearest template.

**CEO transfers but no specialist runs.**
Signature: `TOOL_CALL_START(transfer_to_agent)` → `TOOL_CALL_END` with no TOOL_CALL_ARGS between them, then a 15-30s gap, then `factory_error: "No build plan was produced"`. ADK log shows the transfer target was set but the sub-agent's `run()` never emitted anything. Likely cause: the target name in the CEO's instructions doesn't match any registered sub-agent name, or the sub-agent's `output_schema` is silencing its output so `output_key` never fires. Fix pointer: check `orchestrator/src/orchestrator/agents/ceo.py` for the target name and `orchestrator/src/orchestrator/pipeline_stream.py:_OUTPUT_KEY_TO_AGENT` for the key mapping.

**Factory ran but orchestrator saw no state updates.**
Signature: `factory.jsonl` has a full run, but `orchestrator.jsonl` ends with "Factory delegation failed". Usually an SSE parse error or the factory's `thread_id`/`run_id` got regenerated and the orchestrator's `HandoffChoreographer` timed out. Check `orchestrator/src/orchestrator/tools/delegate.py` — thread_id must be propagated from `thread_id_var`, not freshly minted.

**RUN_STARTED but no downstream messages.**
ADK hit a credential / model-config error before the first LLM call. Look in `orchestrator.jsonl` for a traceback, or check the stdout of the orchestrator process (not captured in the JSONL — process supervisor has it).

**Everything looks fine but the frontend didn't render.**
Wire events reached ag-ui.jsonl but the browser isn't showing them. That's a frontend bug, not an agent-pipeline bug — point the user at `frontend/src/hooks/useCopilotEventBridge.ts` rather than digging further into Python logs.

**`_startup/` contains a traceback.**
The server failed to boot. No `<thread_id>/` folder will exist. Fix the startup error before interpreting anything else.

## When logs don't answer the question

Logs only show what was captured. Things that live outside the JSONL files:

- **LLM request/response payloads** are not logged — if the question is "what exactly did the CEO prompt look like", you need ADK debug mode or an HTTP proxy.
- **Frontend render state** isn't here — if the question is "did the user see X in the UI", this is the wrong skill.
- **Process-level crashes** show up on stdout (uvicorn / systemd / Docker logs), not the JSONL stream.

Say so when the question lands outside the logs' scope rather than guessing.

## Reference

Logging pipeline source of truth:
- `orchestrator/src/orchestrator/logging_context.py` — contextvars, boot_id, run_scope
- `orchestrator/src/orchestrator/logging_config.py` — formatter, ThreadRoutedFileHandler
- `factory/src/factory/logging_config.py` — factory-side mirror
- `frontend/src/app/api/ag-ui-log/route.ts` — frontend write path
- `orchestrator/src/orchestrator/pipeline_stream.py` — where `run_scope` is entered per run
- `orchestrator/src/orchestrator/tools/delegate.py` — where thread_id propagates to factory
