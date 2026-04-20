"""FastAPI app: POST /factory streams AG-UI SSE while the SDK runs."""

from __future__ import annotations

import asyncio
import logging
import uuid
from typing import Any, AsyncIterator

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, StreamingResponse

from factory.agent_flow_events import sse_stream as agent_flow_sse_stream
from factory.factory_event_broker import (
    end_run as broker_end_run,
    is_active as broker_is_active,
    publish_chunk as broker_publish,
    resume_stream as broker_resume_stream,
)
from factory.logging_config import configure_logging
from factory.logging_context import run_scope
from factory.runner import run_build_plan_stream
from factory.settings import Settings
from factory.stream import run_error, run_finished, run_started
from factory.validation import validate_build_plan

logger = logging.getLogger(__name__)


# Active factory runs indexed by thread_id. Populated for the lifetime
# of a `_scoped_build_stream` generator task so a second POST /factory
# for the same thread (or an out-of-band POST /factory/cancel) can
# abort the prior Claude SDK subprocess instead of stacking a second
# build into the same workspace.
_ACTIVE_FACTORY_RUNS: dict[str, asyncio.Task[Any]] = {}


def cancel_factory_run(thread_id: str) -> bool:
    """Cancel an in-flight factory run for ``thread_id``.

    Returns True if a live task was found and cancel was requested. The
    SDK's async-context teardown propagates the cancellation into the
    CLI subprocess, so the subprocess dies with the task.
    """
    task = _ACTIVE_FACTORY_RUNS.get(thread_id)
    if task is None or task.done():
        return False
    task.cancel()
    return True


def cancel_other_factory_runs(keep: str | None) -> list[str]:
    """Cancel every in-flight factory run whose thread_id != ``keep``.

    Sweeps orphaned runs left behind by refreshes, other tabs, or client
    crashes — the current-tab thread survives. Returns the list of
    thread_ids whose task was live and got a cancel signal.
    """
    cancelled: list[str] = []
    for thread_id, task in list(_ACTIVE_FACTORY_RUNS.items()):
        if thread_id == keep or task.done():
            continue
        task.cancel()
        cancelled.append(thread_id)
    return cancelled


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()
    configure_logging()

    app = FastAPI(title="factory", version="0.3.0")
    app.state.settings = settings

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
        allow_credentials=False,
    )

    @app.get("/health")
    async def health() -> dict[str, bool]:
        return {"ok": True}

    @app.get("/agent-flow/events")
    async def agent_flow_events(thread: str = "") -> StreamingResponse:
        # Live stream of simulation-shape envelopes for the vendored
        # agent-flow visualizer, scoped to a single ``thread_id``.
        # Multiple browser windows may subscribe to the same thread.
        if not thread:
            raise HTTPException(
                status_code=400,
                detail="thread query parameter required",
            )
        return StreamingResponse(
            agent_flow_sse_stream(thread),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
        )

    @app.post("/factory")
    async def run_factory(request: Request) -> StreamingResponse:
        body: dict = {}
        try:
            body = await request.json()
        except Exception:
            pass

        thread_id = body.get("threadId") or body.get("thread_id") or str(uuid.uuid4())
        run_id = body.get("runId") or body.get("run_id") or str(uuid.uuid4())
        forwarded = body.get("forwardedProps") or body.get("forwarded_props")

        try:
            build_plan = validate_build_plan(forwarded)
        except Exception as exc:
            return StreamingResponse(
                _scoped_error_stream(thread_id, run_id, str(exc)),
                media_type="text/event-stream",
                headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
            )

        return StreamingResponse(
            _scoped_build_stream(build_plan, settings, thread_id, run_id),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
        )

    @app.get("/factory/resume")
    async def factory_resume(thread: str = "") -> StreamingResponse:
        """Re-attach to an in-flight factory run's AG-UI SSE stream.

        Frontend on mount can call this with a persisted thread_id to
        observe a still-running build after a refresh. Replays buffered
        chunks, then streams live until the run ends.
        """
        if not thread:
            raise HTTPException(
                status_code=400,
                detail="thread query parameter required",
            )
        return StreamingResponse(
            broker_resume_stream(thread),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
        )

    @app.get("/factory/active")
    async def factory_active(thread: str = "") -> JSONResponse:
        """Cheap probe: is a run for ``thread`` currently live?"""
        if not thread:
            return JSONResponse({"active": False})
        return JSONResponse({"active": broker_is_active(thread)})

    @app.post("/factory/cancel")
    async def cancel_factory(request: Request) -> JSONResponse:
        """Cancel an in-flight factory run by thread_id.

        Called by the orchestrator's /orchestrator/cancel handler (which
        the frontend hits on pagehide / new-idea reset) so the Claude
        SDK subprocess dies with the HTTP client instead of continuing
        to write into the workspace while a fresh run starts on top.
        """
        try:
            body = await request.json()
        except Exception:
            body = {}
        thread_id = (body or {}).get("thread_id") or (body or {}).get("threadId")
        if not isinstance(thread_id, str) or not thread_id:
            return JSONResponse(
                {"cancelled": False, "reason": "missing thread_id"},
                status_code=400,
            )
        cancelled = cancel_factory_run(thread_id)
        logger.info("factory cancel_run(%s) → %s", thread_id, cancelled)
        return JSONResponse({"cancelled": cancelled})

    @app.post("/factory/cancel-others")
    async def cancel_others(request: Request) -> JSONResponse:
        """Cancel every in-flight factory run except ``keep``.

        Body: ``{keep: str}``. Called by the orchestrator's
        /orchestrator/cancel-others cascade so a fresh client that
        rotated its thread_id can sweep orphans from prior tabs,
        refreshes, or crashes in a single round-trip.
        """
        try:
            body = await request.json()
        except Exception:
            body = {}
        keep = (body or {}).get("keep") or (body or {}).get("thread_id")
        if keep is not None and not isinstance(keep, str):
            keep = None
        cancelled = cancel_other_factory_runs(keep)
        logger.info("factory cancel_other_runs(keep=%s) → %s", keep, cancelled)
        return JSONResponse({"cancelled": cancelled})

    return app


async def _scoped_build_stream(
    build_plan, settings: Settings, thread_id: str, run_id: str,
) -> AsyncIterator[str]:
    # Register the consuming task under thread_id so a second POST
    # /factory for this thread (or an explicit POST /factory/cancel)
    # can abort the SDK subprocess instead of letting two builds
    # share the same workspace. Matches the orchestrator's
    # _ACTIVE_RUNS dedup pattern.
    task = asyncio.current_task()
    prior = _ACTIVE_FACTORY_RUNS.get(thread_id)
    if prior is not None and prior is not task and not prior.done():
        prior.cancel()
    if task is not None:
        _ACTIVE_FACTORY_RUNS[thread_id] = task

    # Bind thread_id/run_id for the duration of the SSE stream so every
    # log line (factory.runner, subagents, MCP tools) lands in
    # logs/<thread_id>/factory.jsonl next to the orchestrator's files.
    #
    # Each chunk is also tee'd into the per-thread broker so a refreshed
    # client can re-attach via GET /factory/resume and see replay + live
    # events instead of a silent-running background build.
    try:
        with run_scope(thread_id, run_id):
            async for chunk in run_build_plan_stream(build_plan, settings, thread_id):
                broker_publish(thread_id, chunk)
                yield chunk
    finally:
        # Only clean up the broker / registry if THIS task is still the
        # owner of the thread_id. A superseding task (new POST /factory
        # for the same thread) will have already overwritten the entry,
        # and ending its broker here would cut off its subscribers.
        if _ACTIVE_FACTORY_RUNS.get(thread_id) is task:
            _ACTIVE_FACTORY_RUNS.pop(thread_id, None)
            await broker_end_run(thread_id)


async def _scoped_error_stream(
    thread_id: str, run_id: str, message: str,
) -> AsyncIterator[str]:
    with run_scope(thread_id, run_id):
        yield run_started(thread_id, run_id)
        yield run_error(thread_id, run_id, message)
        yield run_finished(thread_id, run_id, [])
