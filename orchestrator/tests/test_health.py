"""Acceptance tests for the orchestrator scaffold.

These tests are the Task-1 floor: `create_app` must be constructible in-process,
`/health` must return `{"ok": true}`, and CORS must whitelist localhost:3000
while rejecting foreign origins.
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from orchestrator.server import create_app
from orchestrator.settings import Settings


@pytest.mark.asyncio
async def test_create_app_is_constructible_without_binding_a_port() -> None:
    """Acceptance criterion: `create_app(settings)` works without a real port."""
    settings = Settings(
        google_api_key="test-key",
        cors_origins=["http://localhost:3000"],
    )
    app = create_app(settings)
    assert app.title == "orchestrator"


@pytest.mark.asyncio
async def test_health_endpoint_returns_ok_true(client: AsyncClient) -> None:
    """Acceptance criterion: `/health` → `{"ok": true}`."""
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"ok": True}


@pytest.mark.asyncio
async def test_cors_allows_localhost_3000(client: AsyncClient) -> None:
    """Acceptance criterion: `Origin: http://localhost:3000` is allowed."""
    response = await client.options(
        "/health",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
        },
    )
    # Starlette's CORSMiddleware replies 200 on valid preflight.
    assert response.status_code == 200
    assert (
        response.headers.get("access-control-allow-origin") == "http://localhost:3000"
    )


@pytest.mark.asyncio
async def test_cors_rejects_foreign_origins(client: AsyncClient) -> None:
    """Acceptance criterion: foreign Origin header is not echoed back."""
    response = await client.options(
        "/health",
        headers={
            "Origin": "http://evil.example",
            "Access-Control-Request-Method": "GET",
        },
    )
    # Starlette returns 400 on a disallowed preflight origin and does not
    # echo the Access-Control-Allow-Origin header.
    assert response.headers.get("access-control-allow-origin") != "http://evil.example"


@pytest.mark.asyncio
async def test_orchestrator_ag_ui_endpoint_is_mounted(client: AsyncClient) -> None:
    """The ADK-wrapped placeholder agent must be reachable at `/orchestrator`.

    We don't assert the full event body here — that's Task 3's job — only that
    the route exists (anything other than 404).
    """
    # POST with an empty JSON body — expect a non-404. 422 (validation) is
    # the happy-path signal that the route is wired and awaiting RunAgentInput.
    response = await client.post("/orchestrator", json={})
    assert response.status_code != 404
