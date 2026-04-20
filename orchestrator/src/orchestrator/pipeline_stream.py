"""PipelineEventStream: AG-UI event generator bridging ADK boardroom and factory.

Wraps ``ADKAgent.run()`` for the orchestrator endpoint with three
responsibilities:

1. Track the "active_agent" the frontend should highlight. Derived from
   ``TextMessageStartEvent.name`` (stamped by the ag_ui_adk author patch)
   for LLM turns and from ``ToolCallStartEvent.tool_call_name`` for
   specialist AgentTool calls — ADK never emits TextMessage events for
   the latter.

2. Gate the transition with a human-in-the-loop (HITL) approval pause
   between the boardroom plan and factory execution.

3. Delegate the assembled BuildPlan to the software factory and stream
   its state events back through the same connection. The BuildPlan is
   picked up from the ``start_factory`` tool-call result event as it
   streams by, so no cross-boundary session read is needed.

The public entry point is ``PipelineEventStream.run(input_data)`` which
yields encoded SSE strings. Out-of-band control is available via the
module-level ``cancel_run``, ``cancel_other_runs``, and ``resolve_hitl``
helpers.
"""

from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass
from typing import Any, AsyncIterator

from ag_ui.core import (
    EventType,
    RunAgentInput,
    RunErrorEvent,
    RunFinishedEvent,
    RunStartedEvent,
    StateDeltaEvent,
    StateSnapshotEvent,
    TextMessageStartEvent,
    ToolCallEndEvent,
    ToolCallResultEvent,
    ToolCallStartEvent,
)
from ag_ui.encoder import EventEncoder
from ag_ui_adk import ADKAgent

from orchestrator.logging_context import run_scope
from orchestrator.settings import Settings
from orchestrator.tools.delegate import delegate_to_factory
from orchestrator.tools.start_factory_tool import BUILD_PLAN_STATE_KEY

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Thread-indexed registries for out-of-band control (cancel, HITL resolve).
# Populated for the lifetime of a single PipelineEventStream.run() call so
# endpoints on a different HTTP connection can reach the running task.
# ---------------------------------------------------------------------------

_ACTIVE_RUNS: dict[str, asyncio.Task[Any]] = {}
_PENDING_HITL: dict[str, asyncio.Future[dict[str, Any]]] = {}


# Specialist AgentTool names. The CEO invokes them as tool calls, so ADK
# never emits TextMessage events for them — /active_agent is derived from
# tool_call_name instead. Every name matches an entry in the frontend
# AGENT_REGISTRY so it resolves to a character sprite.
_SPECIALIST_TOOL_NAMES: frozenset[str] = frozenset(
    {
        "data_structurer",
        "market_analyst",
        "brand_designer",
        "business_planner",
        "strategist",
        "cto",
        "reviewer",
    }
)


# Keepalive cadence during HITL wait. Must be below proxy idle timeouts
# (CDN/nginx defaults are typically 60s).
_HITL_KEEPALIVE_INTERVAL = 25.0


def _cancel_future(fut: asyncio.Future[Any] | None) -> None:
    if fut is not None and not fut.done():
        fut.cancel()


def cancel_run(thread_id: str) -> bool:
    """Cancel an in-flight run. Returns True if one was found."""
    # Drop any pending HITL future too — a new run on the same thread_id
    # must not inherit a stale approval gate.
    _cancel_future(_PENDING_HITL.pop(thread_id, None))
    task = _ACTIVE_RUNS.get(thread_id)
    if task is None or task.done():
        return False
    task.cancel()
    return True


def cancel_other_runs(keep: str | None) -> list[str]:
    """Cancel every in-flight run whose thread_id != ``keep``.

    Sweeps orphans from refreshes, other tabs, or client crashes — the
    current-tab thread survives. Returns thread_ids that got a cancel
    signal.
    """
    cancelled: list[str] = []
    for thread_id, task in list(_ACTIVE_RUNS.items()):
        if thread_id == keep or task.done():
            continue
        _cancel_future(_PENDING_HITL.pop(thread_id, None))
        task.cancel()
        cancelled.append(thread_id)
    return cancelled


def resolve_hitl(thread_id: str, decision: dict[str, Any]) -> bool:
    """Resolve a pending HITL approval. Returns True if a future was waiting."""
    fut = _PENDING_HITL.get(thread_id)
    if fut is None or fut.done():
        return False
    fut.set_result(decision)
    return True


# ---------------------------------------------------------------------------
# ADK failure classification — keeps the "why did my boardroom die?" message
# the UI overlay shows in sync with factory.runner._detect_cli_failure.
# ---------------------------------------------------------------------------

_ADK_FAILURE_PATTERNS: tuple[tuple[tuple[str, ...], str], ...] = (
    (
        ("resource_exhausted", "quota", "429", "rate limit"),
        "Gemini rate limit / quota hit — the agents are yelling into a "
        "full voicemail. Wait a moment and retry.",
    ),
    (
        ("api_key_invalid", "unauthenticated", "invalid api key", "401"),
        "Gemini authentication failed — check GOOGLE_API_KEY / "
        "GOOGLE_APPLICATION_CREDENTIALS.",
    ),
    (
        ("billing", "permission_denied", "403"),
        "Gemini says no — billing or permissions aren't in order. "
        "Enable the API and check the billing account.",
    ),
    (
        ("defaultcredentialserror", "adc"),
        "No Google credentials found. Run `gcloud auth "
        "application-default login` or set GOOGLE_API_KEY.",
    ),
)


def _classify_adk_failure(exc: BaseException | None, stderr_joined: str = "") -> str:
    """Turn a Google-ADK / Gemini failure into a one-line, UI-ready message."""
    haystack = f"{exc!r} {stderr_joined}".lower()
    for needles, message in _ADK_FAILURE_PATTERNS:
        if any(n in haystack for n in needles):
            return message
    if exc is not None:
        return f"{type(exc).__name__}: {exc}"[:240]
    return (
        "Boardroom produced no output. Usually a Gemini auth, quota, or "
        "model-config issue — check the orchestrator logs."
    )


def _extract_build_plan(content: Any) -> dict[str, Any] | None:
    """Pull the BuildPlan dict out of a start_factory tool-call result.

    The tool writes the plan to ``tool_context.state["build_plan"]`` and
    mirrors it into its return payload; we read the mirror to avoid a
    cross-boundary session lookup.
    """
    try:
        payload = json.loads(content)
    except (ValueError, TypeError):
        return None
    if not isinstance(payload, dict):
        return None
    plan = payload.get(BUILD_PLAN_STATE_KEY)
    return plan if isinstance(plan, dict) else None


# ---------------------------------------------------------------------------
# Phase-outcome dataclass and sentinel objects for inter-phase control flow.
# ---------------------------------------------------------------------------

@dataclass
class _BoardroomOutcome:
    """Results captured from the boardroom phase for later phases to inspect."""

    build_plan: dict[str, Any] | None = None
    failure: BaseException | None = None
    meaningful_events: int = 0
    last_author: str | None = None
    ceo_turns: int = 0


# Yielded by _stream_factory to signal terminal states to _run_inner.
_FACTORY_CANCELLED: object = object()
_FACTORY_FAILED: object = object()


# ---------------------------------------------------------------------------
# PipelineEventStream
# ---------------------------------------------------------------------------

class PipelineEventStream:
    """Wraps ADKAgent.run() with active_agent tracking and factory delegation."""

    def __init__(
        self,
        adk_agent: ADKAgent,
        settings: Settings,
        encoder: EventEncoder,
    ) -> None:
        self._adk_agent = adk_agent
        self._settings = settings
        self._encoder = encoder

    # ---- encoding helpers -----------------------------------------------

    def _encode(self, event: Any) -> str:
        return self._encoder.encode(event)

    def _delta(self, *ops: tuple[str, Any]) -> str:
        """Encode a STATE_DELTA with ``add`` ops for each ``(path, value)``."""
        return self._encode(
            StateDeltaEvent(
                type=EventType.STATE_DELTA,
                delta=[{"op": "add", "path": p, "value": v} for p, v in ops],
            )
        )

    def _error(self, message: str, code: str) -> str:
        return self._encode(
            RunErrorEvent(type=EventType.RUN_ERROR, message=message, code=code),
        )

    # ---- public entry point ---------------------------------------------

    async def run(self, input_data: RunAgentInput) -> AsyncIterator[str]:
        thread_id = input_data.thread_id
        run_id = input_data.run_id

        # Register this task under thread_id so POST /orchestrator/cancel
        # can abort a run whose HTTP client vanished (browser refresh →
        # proxy may not propagate the close). A new run for the same
        # thread_id supersedes any prior one.
        task = asyncio.current_task()
        prior = _ACTIVE_RUNS.get(thread_id)
        if prior is not None and prior is not task and not prior.done():
            prior.cancel()
        if task is not None:
            _ACTIVE_RUNS[thread_id] = task

        # Bind correlation ids so every log record emitted downstream
        # (orchestrator, google_adk, factory) carries thread_id/run_id,
        # matching the ids the frontend writes into ag-ui-*.jsonl.
        try:
            with run_scope(thread_id, run_id):
                async for line in self._run_inner(input_data):
                    yield line
        finally:
            # Only pop if we still own the slot — a superseding run may
            # have overwritten it with its own task.
            if _ACTIVE_RUNS.get(thread_id) is task:
                _ACTIVE_RUNS.pop(thread_id, None)

    # ---- main pipeline --------------------------------------------------

    async def _run_inner(self, input_data: RunAgentInput) -> AsyncIterator[str]:
        thread_id = input_data.thread_id
        run_id = input_data.run_id

        # AG-UI protocol requires RUN_STARTED as the very first event.
        yield self._encode(
            RunStartedEvent(
                type=EventType.RUN_STARTED,
                thread_id=thread_id,
                run_id=run_id,
            )
        )
        # Seed CopilotKit's state tree so later "add" ops don't fail with
        # OPERATION_PATH_UNRESOLVABLE on an empty root.
        yield self._encode(
            StateSnapshotEvent(
                type=EventType.STATE_SNAPSHOT,
                snapshot={
                    "active_agent": "ceo",
                    "build_plan": None,
                    "brand": None,
                    "lean_canvas": None,
                },
            )
        )

        # --- Phase 1: boardroom (ADK) ---
        outcome = _BoardroomOutcome()
        async for line in self._stream_boardroom(input_data, outcome):
            yield line

        # Gemini billing/auth failures often drop the stream without an
        # exception or RunErrorEvent. No text/tool events at all means
        # silent failure — surface it so PipelineErrorOverlay can show why.
        if outcome.failure is not None or (
            outcome.build_plan is None and outcome.meaningful_events == 0
        ):
            detail = _classify_adk_failure(outcome.failure)
            logger.error("Boardroom pipeline aborted: %s", detail)
            yield self._error(detail, "adk_failure")
            return

        if outcome.build_plan is None:
            logger.warning(
                "Boardroom stalled: start_factory never called. "
                "last_author=%s, ceo_turns=%d. "
                "If last_author is a specialist and ceo_turns=1, the CEO "
                "handed off and never regained control — verify the CEO "
                "is invoking specialists as AgentTools (not via "
                "transfer_to_agent on sub_agents with output_schema).",
                outcome.last_author,
                outcome.ceo_turns,
            )
            yield self._error(
                "Boardroom ended without producing a build plan — the CEO "
                "never called start_factory. Usually means a specialist "
                "handoff never returned control. Check the orchestrator "
                "logs for the stall point.",
                "no_build_plan",
            )
            return

        build_plan = outcome.build_plan

        # --- Phase 1.5: HITL approval gate ---
        # Default to "timeout" so any generator-completion path without an
        # explicit decision still flows into the rejection branch safely.
        decision: dict[str, Any] = {"approved": False, "reason": "timeout"}
        async for item in self._await_hitl(thread_id, build_plan):
            if isinstance(item, dict):
                decision = item
                break
            yield item

        if not decision.get("approved"):
            reason = decision.get("reason") or "rejected"
            notes = decision.get("notes") or ""
            yield self._delta(("/hitl", {"status": reason}))
            detail = (
                f"Build plan {reason}."
                + (f" Notes: {notes}" if notes else "")
                + " Launch a fresh idea to try again."
            )
            yield self._error(detail, f"hitl_{reason}")
            logger.info("HITL %s — aborting before factory", reason)
            return

        # --- Phase 2: factory delegation ---
        logger.info("Planning complete; delegating to factory")
        yield self._delta(
            ("/hitl", {"status": "approved"}),
            ("/active_agent", "factory"),
            ("/build_plan", build_plan),
        )

        factory_ok = True
        async for item in self._stream_factory(build_plan):
            if item is _FACTORY_CANCELLED:
                return
            if item is _FACTORY_FAILED:
                factory_ok = False
                continue
            assert isinstance(item, str)
            yield item
        if not factory_ok:
            return

        # Emit our own RUN_FINISHED after everything (including factory) is done.
        yield self._encode(
            RunFinishedEvent(
                type=EventType.RUN_FINISHED,
                thread_id=thread_id,
                run_id=run_id,
            )
        )

    # ---- boardroom phase ------------------------------------------------

    async def _force_close_adk_execution(self, input_data: RunAgentInput) -> None:
        """Cancel the ag_ui_adk background task for this run.

        ``ADKAgent.run()`` spawns a separate asyncio task in
        ``_start_background_execution`` that iterates ``runner.run_async()``
        and pushes events into a queue. Closing the outer async generator
        via ``aclose()`` stops the consumer but does **not** cancel that
        background task — the Gemini Runner keeps firing LLM calls (the
        CEO's ``tool_config.mode=ANY`` forces a tool call every turn),
        burning tokens silently while HITL / factory runs.

        Reach into ``ADKAgent._active_executions`` and cancel the
        ``ExecutionState`` task ourselves.
        """
        adk = self._adk_agent
        active = getattr(adk, "_active_executions", None)
        if not active:
            return
        try:
            user_id = adk._get_user_id(input_data)  # type: ignore[attr-defined]
        except Exception:
            user_id = None
        thread_id = input_data.thread_id
        execution = None
        if user_id is not None:
            execution = active.get((thread_id, user_id))
        if execution is None:
            # Fall back to any execution registered under this thread_id
            # in case user-id resolution disagrees with the one ADK used.
            for (tid, _uid), ex in list(active.items()):
                if tid == thread_id:
                    execution = ex
                    break
        if execution is None:
            return
        try:
            await execution.cancel()
            logger.info(
                "Forced ADK execution cancel for thread %s (stops Gemini token burn)",
                thread_id,
            )
        except Exception:
            logger.debug("ExecutionState.cancel() raised", exc_info=True)

    async def _stream_boardroom(
        self,
        input_data: RunAgentInput,
        outcome: _BoardroomOutcome,
    ) -> AsyncIterator[str]:
        """Consume the ADK stream, track active_agent, capture build_plan."""
        current_agent: str | None = "ceo"
        # tool_call_id -> tool name. Lets us recognize the start_factory
        # result event as it streams past and snap /active_agent back to
        # "ceo" when a specialist tool call ends.
        tool_call_names: dict[str, str] = {}

        # Keep a handle so we can aclose() on break. Python doesn't
        # auto-close async generators on `break` — it waits for GC, which
        # on CPython means runner.run_async keeps firing LLM calls
        # (burning tokens, spamming logs with more CEO turns) long after
        # we've captured start_factory and moved to HITL/factory.
        adk_stream = self._adk_agent.run(input_data)
        try:
            async for event in adk_stream:
                # Forward ADK's own RunErrorEvent through the overlay path.
                if isinstance(event, RunErrorEvent):
                    outcome.failure = RuntimeError(event.message)
                    break
                # Suppress ADK's RUN_STARTED/FINISHED — we emit our own.
                if isinstance(event, (RunStartedEvent, RunFinishedEvent)):
                    continue

                if isinstance(event, (TextMessageStartEvent, ToolCallStartEvent)):
                    outcome.meaningful_events += 1

                # --- per-event-type bookkeeping + active_agent tracking ---
                if isinstance(event, ToolCallStartEvent):
                    tool_call_names[event.tool_call_id] = event.tool_call_name
                    # Specialists run as AgentTools, so ADK emits no
                    # TextMessageStart — the author-patch channel is silent.
                    # Derive /active_agent from the tool name so the
                    # frontend can swap spotlight + play handoff animations.
                    if (
                        event.tool_call_name in _SPECIALIST_TOOL_NAMES
                        and current_agent != event.tool_call_name
                    ):
                        current_agent = event.tool_call_name
                        yield self._delta(("/active_agent", current_agent))
                elif isinstance(event, ToolCallEndEvent):
                    # Specialist AgentTool returning ⇒ control snaps back to
                    # the CEO; signal so the frontend can walk the specialist
                    # home and re-spotlight the CEO.
                    ended = tool_call_names.get(event.tool_call_id)
                    if ended in _SPECIALIST_TOOL_NAMES and current_agent != "ceo":
                        current_agent = "ceo"
                        yield self._delta(("/active_agent", "ceo"))
                elif isinstance(event, ToolCallResultEvent):
                    if tool_call_names.get(event.tool_call_id) == "start_factory":
                        outcome.build_plan = _extract_build_plan(event.content)

                # CEO's tool_config.mode=ANY forces a tool call every turn,
                # so once start_factory has produced a build_plan we must
                # break the ADK loop ourselves — otherwise the CEO keeps
                # re-calling start_factory forever. Yield this final event,
                # then fall through to HITL/factory.
                if outcome.build_plan is not None:
                    yield self._encode(event)
                    logger.info(
                        "start_factory captured (%d steps); breaking ADK loop",
                        len(outcome.build_plan.get("steps", [])),
                    )
                    break

                # Derive /active_agent from message authorship. The author
                # patch (patches/ag_ui_adk_author.py) stamps the ADK agent
                # name onto TextMessageStartEvent.name for every turn.
                if isinstance(event, TextMessageStartEvent) and event.name:
                    outcome.last_author = event.name
                    if event.name == "ceo":
                        outcome.ceo_turns += 1
                    if event.name != current_agent:
                        current_agent = event.name
                        yield self._delta(("/active_agent", event.name))

                yield self._encode(event)
        except Exception as exc:  # noqa: BLE001 — classified for UI surface
            outcome.failure = exc
            logger.exception("ADK run raised")
        finally:
            # Kill the boardroom task. Without this the CEO keeps looping
            # (tool_config.mode=ANY forces a call every turn) and we pay
            # for it silently while the factory phase runs. aclose() on
            # the async generator is not enough — ag_ui_adk runs the
            # Gemini Runner on a *separate* background asyncio task, so
            # we also cancel the ExecutionState directly.
            await self._force_close_adk_execution(input_data)
            try:
                await adk_stream.aclose()
            except Exception:
                logger.debug("adk_stream.aclose() raised", exc_info=True)

    # ---- HITL approval gate ---------------------------------------------

    async def _await_hitl(
        self,
        thread_id: str,
        build_plan: dict[str, Any],
    ) -> AsyncIterator[str | dict[str, Any]]:
        """Yield the initial /hitl state, keepalives, and finally the decision.

        Yields strings (encoded events or SSE keepalive comments) while
        waiting, then yields the decision dict as its final item. Times
        out after ``settings.hitl_timeout_seconds`` with
        ``{"approved": False, "reason": "timeout"}``.
        """
        yield self._delta(
            (
                "/hitl",
                {
                    "status": "awaiting",
                    "build_plan": build_plan,
                    "timeout_seconds": self._settings.hitl_timeout_seconds,
                },
            ),
        )

        loop = asyncio.get_running_loop()
        hitl_future: asyncio.Future[dict[str, Any]] = loop.create_future()
        _PENDING_HITL[thread_id] = hitl_future
        deadline = loop.time() + self._settings.hitl_timeout_seconds

        # Wait in ~25s slices and emit an SSE comment between them so
        # reverse proxies with short idle-timeouts don't close the
        # connection while the human deliberates. ``asyncio.wait`` on a
        # future doesn't cancel the future when the timeout fires — only
        # the wait-handle resolves — so we can loop safely without
        # touching the future itself.
        try:
            while True:
                remaining = deadline - loop.time()
                if remaining <= 0:
                    yield {"approved": False, "reason": "timeout"}
                    return
                slice_seconds = min(_HITL_KEEPALIVE_INTERVAL, remaining)
                done, _rest = await asyncio.wait(
                    {hitl_future}, timeout=slice_seconds,
                )
                if hitl_future in done:
                    yield hitl_future.result()
                    return
                yield ": hitl-keepalive\n\n"
        finally:
            # Only clear if it's still ours — a superseding run on the
            # same thread_id may have overwritten the slot.
            if _PENDING_HITL.get(thread_id) is hitl_future:
                _PENDING_HITL.pop(thread_id, None)

    # ---- factory phase --------------------------------------------------

    async def _stream_factory(
        self,
        build_plan: dict[str, Any],
    ) -> AsyncIterator[str | object]:
        """Run the factory, streaming its state events.

        Yields encoded event strings for normal state updates. Terminal
        signals to the caller:

          * ``_FACTORY_CANCELLED`` — task was cancelled (client aborted).
          * ``_FACTORY_FAILED``    — task returned None / errored; an
            error event has already been yielded before the sentinel.
          * otherwise finishes normally after yielding a
            ``/factory_result`` delta.
        """
        # Queue so factory state events stream in real time instead of
        # buffering until completion.
        queue: asyncio.Queue[str | None] = asyncio.Queue()

        async def emit_state(state: dict[str, Any]) -> None:
            encoded = self._delta(*[(f"/{k}", v) for k, v in state.items()])
            await queue.put(encoded)

        async def run_factory() -> dict[str, Any] | None:
            try:
                return await delegate_to_factory(
                    build_plan, self._settings, emit_state,
                )
            except Exception:
                logger.exception("Factory delegation failed")
                return None
            finally:
                await queue.put(None)  # drain-loop sentinel

        task = asyncio.create_task(run_factory())

        # If the client aborts (abortRun → HTTP disconnect), this
        # generator is cancelled and we must propagate the cancellation
        # into the factory task — otherwise the detached task keeps
        # awaiting the factory's SSE stream and the Claude SDK subprocess
        # never terminates.
        try:
            while True:
                encoded = await queue.get()
                if encoded is None:
                    break
                yield encoded
        finally:
            if not task.done():
                task.cancel()
                try:
                    await task
                except (asyncio.CancelledError, Exception):
                    pass

        if task.cancelled():
            yield _FACTORY_CANCELLED
            return

        result = task.result()
        if result is None:
            # Factory failed without raising a FactoryError (e.g. the
            # handoff-choreographer swallowed an exception). Surface it
            # so the frontend overlay lights up instead of silently
            # finishing with handoff_stage=failed.
            yield self._error(
                "Factory delegation failed. Check factory server logs "
                "for the underlying cause.",
                "factory_delegation_failed",
            )
            logger.error("Factory delegation returned None — RUN_ERROR emitted")
            yield _FACTORY_FAILED
            return

        yield self._delta(("/factory_result", result))
        logger.info("Factory delegation complete: %s", result.get("status"))
