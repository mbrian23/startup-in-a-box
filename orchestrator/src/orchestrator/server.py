"""FastAPI application factory for the orchestrator."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse, StreamingResponse

from ag_ui.core import RunAgentInput
from ag_ui.encoder import EventEncoder
from ag_ui_adk import ADKAgent
from pydantic import ValidationError

# Install runtime patches before any ADK agent is constructed or streamed.
# Order matters: this must precede any import that uses the translator.
import orchestrator.patches  # noqa: F401  (side-effect import)
from orchestrator.agents.ceo import build_ceo_agent
from orchestrator.logging_config import configure_logging
from orchestrator.pipeline_stream import (
    PipelineEventStream,
    cancel_other_runs,
    cancel_run,
    resolve_hitl,
)
from orchestrator.settings import Settings

if TYPE_CHECKING:
    from google.adk.tools.base_tool import BaseTool

logger = logging.getLogger(__name__)


def create_app(
    settings: Settings | None = None,
    *,
    search_tool: BaseTool | None = None,
) -> FastAPI:
    settings = settings or Settings()
    configure_logging(settings)
    _warn_on_daily_quota_model(settings)

    app = FastAPI(title="orchestrator", version="0.1.0")
    _install_cors(app, settings)
    _install_health(app, settings)
    _install_demo_endpoint(app)
    _install_adk_endpoint(app, settings, search_tool=search_tool)

    return app


# Free-tier AI Studio models that impose a per-day request cap most
# easily tripped by multi-turn CEO runs. The free-tier daily quota for
# these sits at 250 req/day; one full boardroom run burns ~8–20, so a
# single tab's worth of iteration can exhaust the bucket before noon.
# Flash / Flash-Lite have separate, much higher per-day buckets.
_DAILY_QUOTA_MODEL_PREFIXES = ("gemini-3.1-pro", "gemini-2.5-pro")


def _warn_on_daily_quota_model(settings: Settings) -> None:
    """Log a startup warning when a low-daily-quota Gemini model is configured.

    Surfaces the 250/day cap before it trips silently — the symptom
    when it does trip is "UI stuck on awaiting run…" because the CEO's
    first LLM call 429s and the frontend never sees an active_agent
    delta. No quota is consumed by this check; it only inspects config.
    """
    suspects: list[tuple[str, str]] = []
    for label, value in (
        ("ORCHESTRATOR_MODEL", settings.orchestrator_model),
        ("CEO_MODEL", settings.ceo_model),
        ("CTO_MODEL", settings.cto_model),
    ):
        if any(value.startswith(p) for p in _DAILY_QUOTA_MODEL_PREFIXES):
            suspects.append((label, value))
    if not suspects:
        return
    bullets = "\n  ".join(f"- {label} = {value}" for label, value in suspects)
    logger.warning(
        "Pro-tier Gemini model(s) configured — free tier caps these at "
        "~250 requests/day, which a single boardroom run can exhaust:\n  "
        "%s\nConsider `gemini-3-flash-preview` for ORCHESTRATOR_MODEL / "
        "CEO_MODEL unless you're on a paid billing account. Quota "
        "exhaustion surfaces as a 429 and is classified to the UI.",
        bullets,
    )


def _install_cors(app: FastAPI, settings: Settings) -> None:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
        allow_credentials=False,
    )


def _install_health(app: FastAPI, settings: Settings) -> None:
    @app.get("/health")
    async def health(deep: bool = False) -> dict[str, bool]:
        if not deep:
            return {"ok": True}
        llm_reachable = await _check_gemini_reachable(settings)
        return {"ok": llm_reachable, "llm_reachable": llm_reachable}


async def _check_gemini_reachable(settings: Settings) -> bool:
    import httpx
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{settings.api_base_url}/v1/models")
            return resp.status_code == 200
    except Exception:
        return False


def _install_demo_endpoint(app: FastAPI) -> None:
    """Replay pre-recorded AG-UI events from the demo fixture.

    GET /orchestrator/demo?speed=4 streams the boardroom.jsonl fixture
    as SSE with timing scaled by the speed factor. No LLM, no ADK, no
    API keys needed — the frontend receives the same event shapes as a
    live run.
    """
    import asyncio
    import json
    from pathlib import Path

    fixture = Path(__file__).resolve().parents[4] / "frontend" / "public" / "demo" / "boardroom.jsonl"

    @app.get("/orchestrator/demo")
    async def orchestrator_demo(speed: float = 4.0):
        if not fixture.exists():
            return JSONResponse(
                {"error": "Demo fixture not found", "path": str(fixture)},
                status_code=404,
            )

        factor = max(0.1, min(speed, 20.0))
        events: list[dict[str, Any]] = []
        for line in fixture.read_text().splitlines():
            if line.strip():
                events.append(json.loads(line))

        async def generate():
            prev_delay = 0
            for entry in events:
                gap = max(0, (entry["delay_ms"] - prev_delay) / factor)
                prev_delay = entry["delay_ms"]
                if gap > 0:
                    await asyncio.sleep(gap / 1000.0)
                yield f"data: {json.dumps(entry['event'])}\n\n"

        return StreamingResponse(
            generate(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache, no-transform"},
        )

    @app.post("/orchestrator/demo")
    async def orchestrator_demo_post(request: Request):
        """Accept POST requests for demo mode (CopilotKit sends POSTs)."""
        speed = 4.0
        try:
            body = await request.json()
            if "body" in body:
                body = body["body"]
        except Exception:
            pass

        if not fixture.exists():
            return JSONResponse(
                {"error": "Demo fixture not found"},
                status_code=404,
            )

        factor = max(0.1, min(speed, 20.0))
        events: list[dict[str, Any]] = []
        for line in fixture.read_text().splitlines():
            if line.strip():
                events.append(json.loads(line))

        async def generate():
            prev_delay = 0
            for entry in events:
                gap = max(0, (entry["delay_ms"] - prev_delay) / factor)
                prev_delay = entry["delay_ms"]
                if gap > 0:
                    await asyncio.sleep(gap / 1000.0)
                yield f"data: {json.dumps(entry['event'])}\n\n"

        return StreamingResponse(
            generate(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache, no-transform"},
        )


def _install_adk_endpoint(
    app: FastAPI,
    settings: Settings,
    *,
    search_tool: BaseTool | None = None,
) -> None:
    ceo_agent = build_ceo_agent(settings, search_tool=search_tool)
    adk_agent = ADKAgent(
        adk_agent=ceo_agent,
        app_name="orchestrator",
        user_id="demo-user",
        use_in_memory_services=True,
    )

    _INFO_RESPONSE = {
        "version": "0.1.0",
        "agents": {
            "default": {
                "name": "default",
                "className": "LlmAgent",
                "description": "CEO-coordinated startup planning pipeline",
            },
        },
        "audioFileTranscriptionEnabled": False,
        "mode": "sse",
    }

    # CopilotKit /info endpoint — lets CopilotKit auto-detect "rest" transport
    # and discover available agents without hitting the AG-UI validator.
    @app.get("/orchestrator/info")
    async def orchestrator_info() -> dict[str, Any]:
        return _INFO_RESPONSE

    @app.post("/orchestrator", response_model=None)
    async def orchestrator_endpoint(request: Request):
        """AG-UI endpoint that injects active_agent STATE_DELTA events.

        Wraps the standard ADKAgent.run() to track TEXT_MESSAGE_START
        transitions and emit STATE_DELTA events so the frontend knows
        which sub-agent is currently speaking.

        Handles CopilotKit envelope format: unwraps
        ``{ method, params, body: { threadId, ... } }`` into a flat
        RunAgentInput when necessary.
        """
        raw_body = await request.json()

        # CopilotKit POSTs {"method": "info"} for runtime discovery.
        if raw_body.get("method") == "info":
            return JSONResponse(_INFO_RESPONSE)

        # CopilotKit wraps the AG-UI payload in an envelope with a "body" key.
        if "body" in raw_body and "threadId" not in raw_body:
            raw_body = raw_body["body"]

        try:
            input_data = RunAgentInput.model_validate(raw_body)
        except ValidationError as exc:
            return JSONResponse({"detail": exc.errors()}, status_code=422)

        accept_header = request.headers.get("accept")
        encoder = EventEncoder(accept=accept_header)

        stream = PipelineEventStream(adk_agent, settings, encoder)

        return StreamingResponse(
            stream.run(input_data),
            media_type=encoder.get_content_type(),
        )

    @app.post("/orchestrator/cancel")
    async def orchestrator_cancel(request: Request) -> dict[str, Any]:
        """Cancel an in-flight run by thread_id.

        Called by the frontend on page unload / new-idea reset so a run
        whose HTTP client is about to vanish can be torn down
        immediately. Closing the orchestrator→factory HTTP stream
        doesn't propagate TCP-close to the Claude SDK subprocess, so we
        also POST to the factory's own cancel endpoint to kill the
        build from the inside.
        """
        try:
            body = await request.json()
        except Exception:
            body = {}
        thread_id = (body or {}).get("thread_id") or (body or {}).get("threadId")
        if not isinstance(thread_id, str) or not thread_id:
            return {"cancelled": False, "reason": "missing thread_id"}
        cancelled = cancel_run(thread_id)
        factory_cancelled = await _cancel_factory_run(settings, thread_id)
        logger.info(
            "cancel_run(%s) → orchestrator=%s factory=%s",
            thread_id, cancelled, factory_cancelled,
        )
        return {"cancelled": cancelled, "factory_cancelled": factory_cancelled}

    @app.post("/orchestrator/cancel-others")
    async def orchestrator_cancel_others(request: Request) -> dict[str, Any]:
        """Cancel every in-flight run except ``keep``, orchestrator + factory.

        Body: ``{keep: str}``. The frontend calls this on mount, spawn,
        and reset with the newly minted threadId so any orphan runs
        from refreshes, other tabs, or crashed sessions get torn down
        in a single cascade — the orchestrator owns _ACTIVE_RUNS and
        the client can't enumerate what it doesn't remember.
        """
        try:
            body = await request.json()
        except Exception:
            body = {}
        keep = (body or {}).get("keep") or (body or {}).get("thread_id")
        if keep is not None and not isinstance(keep, str):
            keep = None
        cancelled = cancel_other_runs(keep)
        factory_cancelled = await _cancel_other_factory_runs(settings, keep)
        logger.info(
            "cancel_other_runs(keep=%s) → orchestrator=%s factory=%s",
            keep, cancelled, factory_cancelled,
        )
        return {"cancelled": cancelled, "factory_cancelled": factory_cancelled}


    @app.post("/orchestrator/hitl")
    async def orchestrator_hitl(request: Request) -> dict[str, Any]:
        """Resolve a pending HITL approval for ``thread_id``.

        Body: ``{thread_id, approved: bool, notes?: str}``.
        The pipeline is paused in ``_run_inner`` awaiting this decision;
        resolving the future either releases delegation to the factory
        or emits a RUN_ERROR and stops.
        """
        try:
            body = await request.json()
        except Exception:
            body = {}
        thread_id = (body or {}).get("thread_id") or (body or {}).get("threadId")
        approved = bool((body or {}).get("approved"))
        notes = (body or {}).get("notes") or ""
        if not isinstance(thread_id, str) or not thread_id:
            return {"resolved": False, "reason": "missing thread_id"}
        resolved = resolve_hitl(thread_id, {"approved": approved, "notes": notes})
        logger.info("hitl(%s) approved=%s → %s", thread_id, approved, resolved)
        return {"resolved": resolved}


def _factory_cancel_url(settings: Settings, suffix: str) -> str:
    """Compose the factory's cancel URL, tolerating a trailing /factory."""
    base = settings.factory_url.rstrip("/")
    if base.endswith("/factory"):
        base = base[: -len("/factory")]
    return f"{base}/factory/{suffix}"


async def _cancel_factory_run(settings: Settings, thread_id: str) -> bool:
    """Best-effort POST to the factory's /factory/cancel endpoint.

    Derives the factory host from ``settings.factory_url`` so overrides
    in `.env` still work. Failures are swallowed — the frontend's cancel
    is called during unload and must never raise.
    """
    import httpx
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(
                _factory_cancel_url(settings, "cancel"),
                json={"thread_id": thread_id},
            )
            if resp.status_code != 200:
                return False
            payload = resp.json()
            return bool(payload.get("cancelled"))
    except Exception:
        return False


async def _cancel_other_factory_runs(
    settings: Settings, keep: str | None,
) -> list[str]:
    """Best-effort POST to /factory/cancel-others. Returns the swept ids."""
    import httpx
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(
                _factory_cancel_url(settings, "cancel-others"),
                json={"keep": keep},
            )
            if resp.status_code != 200:
                return []
            payload = resp.json()
            result = payload.get("cancelled")
            return [x for x in result if isinstance(x, str)] if isinstance(result, list) else []
    except Exception:
        return []
