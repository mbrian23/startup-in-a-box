"""Server health, CORS, and endpoint smoke tests."""

from __future__ import annotations

from httpx import AsyncClient


async def test_health_returns_ok(client: AsyncClient) -> None:
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}


async def test_cors_allows_localhost_3000(client: AsyncClient) -> None:
    resp = await client.options(
        "/health",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert resp.headers.get("access-control-allow-origin") == "http://localhost:3000"


async def test_cors_rejects_foreign_origin(client: AsyncClient) -> None:
    resp = await client.options(
        "/health",
        headers={
            "Origin": "http://evil.example.com",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert "access-control-allow-origin" not in resp.headers


async def test_factory_endpoint_rejects_missing_build_plan(client: AsyncClient) -> None:
    resp = await client.post("/factory", json={})
    assert resp.status_code == 200
    lines = resp.text.strip().split("\n")
    assert any("RUN_ERROR" in line for line in lines)


async def test_factory_active_returns_false_for_unknown_thread(client: AsyncClient) -> None:
    resp = await client.get("/factory/active", params={"thread": "nonexistent"})
    assert resp.status_code == 200
    assert resp.json() == {"active": False}


async def test_cancel_rejects_missing_thread_id(client: AsyncClient) -> None:
    resp = await client.post("/factory/cancel", json={})
    assert resp.status_code == 400
    assert resp.json()["cancelled"] is False
