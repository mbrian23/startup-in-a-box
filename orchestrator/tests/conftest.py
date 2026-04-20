"""Shared test fixtures for the orchestrator scaffold.

All tests boot the app via `create_app(settings)` in-process through
`asgi-lifespan` — no real port binding, no cross-test state bleed.
"""

from __future__ import annotations

from typing import AsyncIterator

import pytest
import pytest_asyncio
from asgi_lifespan import LifespanManager
from httpx import ASGITransport, AsyncClient

from orchestrator.server import create_app
from orchestrator.settings import Settings


@pytest.fixture
def settings() -> Settings:
    """Hermetic settings for tests.

    Explicit instance per test — never falls through to the real environment.
    """
    return Settings(
        port=0,
        cors_origins=["http://localhost:3000"],
        google_api_key="test-key",
        factory_url="http://localhost:8888/factory",
        log_jsonl=False,
    )


@pytest_asyncio.fixture
async def client(settings: Settings) -> AsyncIterator[AsyncClient]:
    """In-process httpx client for the orchestrator app."""
    app = create_app(settings)
    async with LifespanManager(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(
            transport=transport,
            base_url="http://testserver",
        ) as http_client:
            yield http_client
