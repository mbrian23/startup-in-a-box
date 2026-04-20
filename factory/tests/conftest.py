"""Shared test fixtures for the factory scaffold."""

from __future__ import annotations

from typing import AsyncIterator

import pytest
import pytest_asyncio
from asgi_lifespan import LifespanManager
from httpx import ASGITransport, AsyncClient

from factory.server import create_app
from factory.settings import Settings


@pytest.fixture
def settings() -> Settings:
    return Settings(
        port=0,
        cors_origins=["http://localhost:3000"],
        anthropic_api_key="test-key",
        workspace_root="/tmp/factory-test-workspace",
    )


@pytest_asyncio.fixture
async def client(settings: Settings) -> AsyncIterator[AsyncClient]:
    app = create_app(settings)
    async with LifespanManager(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(
            transport=transport,
            base_url="http://testserver",
        ) as http_client:
            yield http_client
