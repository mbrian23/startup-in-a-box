"""Handoff choreographer -- policy layer for the factory delegation.

Drives the beat sequence: preparing -> sleep -> launched -> forward progress
-> returned/failed. Takes an SseClient and a state emitter as dependencies.

SRP: orchestrates the handoff state machine. Does not parse SSE or know ADK.
DIP: depends on SseClient abstraction and a callable emitter, not concretions.
OCP: new beat stages extend the emission sequence without rewriting existing logic.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Callable, Coroutine

from orchestrator.sse.client import AgUiEvent, SseClient

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Error hierarchy — LSP: every subtype is substitutable for FactoryError.
# All three emit handoff_stage "failed" before raising.
# ---------------------------------------------------------------------------


class FactoryError(Exception):
    """Base error for factory delegation failures."""


class FactoryConnectError(FactoryError):
    """Could not reach the factory endpoint."""


class FactoryRunError(FactoryError):
    """Factory emitted RUN_ERROR during the run."""


class FactoryTimeoutError(FactoryError):
    """SSE stream went idle beyond the configured timeout."""


# Emitter accepts a full state dict — the choreographer doesn't
# decompose or filter the factory's state shape.
StateEmitter = Callable[[dict[str, Any]], Coroutine[Any, Any, None]]


class HandoffChoreographer:
    """Drives the handoff beat sequence against a factory SSE stream.

    Dependencies injected via constructor (DIP):
    - sse_client: infrastructure for streaming events
    - emit_state: callback to push a state delta dict to the orchestrator stream
    - beat1_duration: deliberate pacing sleep (seconds)
    - idle_timeout: max seconds of SSE silence before timeout
    """

    def __init__(
        self,
        sse_client: SseClient,
        emit_state: StateEmitter,
        beat1_duration: float,
        idle_timeout: int,
    ) -> None:
        self._sse_client = sse_client
        self._emit_state = emit_state
        self._beat1_duration = beat1_duration
        self._idle_timeout = idle_timeout

    async def execute(
        self,
        factory_url: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        """Run the full handoff choreography. Returns the shipped result dict."""
        await self._emit_state({"handoff_stage": "preparing"})

        try:
            event_iter = self._sse_client.stream_events(factory_url, payload)
            return await self._drive_beats(event_iter)
        except FactoryError:
            raise
        except Exception as exc:
            await self._emit_state({"handoff_stage": "failed"})
            raise FactoryRunError(str(exc)) from exc

    async def _drive_beats(
        self,
        event_iter: Any,
    ) -> dict[str, Any]:
        """Consume events and drive the beat state machine.

        Terminal events (RUN_ERROR, RUN_FINISHED) are tolerated at any
        stage after "preparing" -- if the factory fails before the beat1
        sleep completes, we skip straight to "failed".
        """
        launched = False
        factory_run_id = ""
        artifacts_written: list[str] = []

        # Deliberate pacing: Beat 1 animation needs breathing room.
        beat1_task = asyncio.create_task(asyncio.sleep(self._beat1_duration))

        async def ensure_launched() -> None:
            nonlocal launched
            if not launched:
                await beat1_task
                await self._emit_state({"handoff_stage": "launched"})
                launched = True

        try:
            async for event in self._iter_with_idle_timeout(event_iter):
                if event.type == "RUN_ERROR":
                    beat1_task.cancel()
                    await self._emit_state({"handoff_stage": "failed"})
                    error_msg = event.data.get("message", "Factory run error")
                    raise FactoryRunError(error_msg)

                if event.type == "RUN_STARTED":
                    factory_run_id = (
                        event.data.get("threadId")
                        or event.data.get("thread_id", "")
                    )
                    await ensure_launched()

                if event.type == "STATE_DELTA":
                    await ensure_launched()
                    await self._forward_factory_delta(event)

                if event.type == "RUN_FINISHED":
                    artifacts_written = event.data.get("artifacts", [])
                    break

        except FactoryError:
            beat1_task.cancel()
            raise
        except asyncio.CancelledError:
            beat1_task.cancel()
            await self._emit_state({"handoff_stage": "failed"})
            raise FactoryTimeoutError("Handoff cancelled") from None
        finally:
            beat1_task.cancel()

        await self._emit_state({"handoff_stage": "returned"})
        return {
            "factory_run_id": factory_run_id,
            "artifacts_written": artifacts_written,
            "status": "shipped",
        }

    async def _iter_with_idle_timeout(
        self,
        event_iter: Any,
    ) -> Any:
        """Wrap the event iterator with per-line idle timeout detection."""
        aiter = event_iter.__aiter__()
        while True:
            try:
                async with asyncio.timeout(self._idle_timeout):
                    event = await aiter.__anext__()
            except StopAsyncIteration:
                return
            except TimeoutError:
                await self._emit_state({"handoff_stage": "failed"})
                raise FactoryTimeoutError(
                    f"Factory SSE stream idle for {self._idle_timeout}s"
                ) from None
            yield event

    async def _forward_factory_delta(self, event: AgUiEvent) -> None:
        """Forward the factory's STATE_DELTA to the orchestrator stream.

        AG-UI wire format sends ``delta`` as a list of JSON-Patch ops
        (``[{"op": "add", "path": "/active_agent", "value": "architect"}, ...]``).
        Flatten back to a dict for ``_emit_state`` — pipeline_stream will
        re-encode it as JSON-Patch when forwarding to the frontend.

        Tolerates the legacy dict shape so a future factory variant that
        sends ``{"delta": {"key": value}}`` still works.
        """
        delta = event.data.get("delta")
        if isinstance(delta, list):
            flat = {
                op["path"].lstrip("/"): op.get("value")
                for op in delta
                if (
                    isinstance(op, dict)
                    and op.get("op") in ("add", "replace")
                    and isinstance(op.get("path"), str)
                    and op["path"].startswith("/")
                )
            }
            if flat:
                if "files" in flat:
                    files_val = flat["files"]
                    count = len(files_val) if isinstance(files_val, dict) else "?"
                    logger.info(
                        "handoff.forward files delta: count=%s keys=%s",
                        count,
                        sorted(files_val.keys())
                        if isinstance(files_val, dict)
                        else files_val,
                    )
                if "progress" in flat:
                    logger.info(
                        "handoff.forward progress delta: %s", flat["progress"]
                    )
                logger.debug("handoff.forward flat delta keys: %s", sorted(flat.keys()))
                await self._emit_state(flat)
            return
        if isinstance(delta, dict) and delta:
            logger.debug("handoff.forward dict delta keys: %s", sorted(delta.keys()))
            await self._emit_state(delta)
