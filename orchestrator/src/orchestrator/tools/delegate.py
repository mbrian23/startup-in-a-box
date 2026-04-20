"""ADK tool shim for delegating a BuildPlan to the factory.

Thin wrapper (~15 LOC of logic): constructs the HandoffChoreographer
with its dependencies and awaits the result.

SRP: wiring only. No policy, no SSE parsing.
"""

from __future__ import annotations

import uuid
from typing import Any

import httpx

from orchestrator.logging_context import run_id_var, thread_id_var
from orchestrator.settings import Settings
from orchestrator.sse.client import SseClient
from orchestrator.tools.handoff import HandoffChoreographer, StateEmitter


async def delegate_to_factory(
    build_plan: dict[str, Any],
    settings: Settings,
    emit_state: StateEmitter,
) -> dict[str, Any]:
    """Delegate a BuildPlan to the factory and return the result.

    Propagates the parent orchestrator's thread_id/run_id so every
    component (ag-ui, orchestrator, adk, factory) writes logs into the
    same logs/<thread_id>/ folder — one folder gives the full pipeline
    view. Falls back to fresh UUIDs only when called outside a
    run_scope (shouldn't happen in normal flow).
    """
    thread_id = thread_id_var.get() or str(uuid.uuid4())
    run_id = run_id_var.get() or str(uuid.uuid4())

    payload = {
        "thread_id": thread_id,
        "run_id": run_id,
        "messages": [],
        "forwarded_props": {"build_plan": build_plan},
    }

    async with httpx.AsyncClient(timeout=None) as http_client:
        sse_client = SseClient(http_client)
        choreographer = HandoffChoreographer(
            sse_client=sse_client,
            emit_state=emit_state,
            beat1_duration=settings.handoff_beat1_duration_seconds,
            idle_timeout=settings.factory_idle_timeout_seconds,
        )
        return await choreographer.execute(settings.factory_url, payload)
