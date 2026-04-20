"""E2E test fixtures — subprocess orchestration for all three modules.

DIP: Tests boot modules via their public entry points (uvicorn factory,
``create_app``). No direct imports from one module's internals into
another module's test fixtures.

The ``live_stack`` fixture is only used by ``pytest -m live`` tests.
Default (fixture-replay) tests use the ``golden_path_events`` fixture
to feed recorded events into assertions without booting backends.
"""

from __future__ import annotations

import json
import subprocess
import time
from pathlib import Path
from typing import Generator

import httpx
import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"

ORCHESTRATOR_PORT = 8000
FACTORY_PORT = 8888
FRONTEND_PORT = 3000

ORCHESTRATOR_URL = f"http://localhost:{ORCHESTRATOR_PORT}"
FACTORY_URL = f"http://localhost:{FACTORY_PORT}"
FRONTEND_URL = f"http://localhost:{FRONTEND_PORT}"


def _wait_for_health(url: str, timeout: float = 30.0) -> bool:
    """Poll a /health endpoint until it returns 200 or timeout."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            resp = httpx.get(f"{url}/health", timeout=5.0)
            if resp.status_code == 200:
                return True
        except httpx.ConnectError:
            pass
        time.sleep(0.5)
    return False


@pytest.fixture(scope="session")
def live_stack() -> Generator[dict[str, str], None, None]:
    """Boot factory, orchestrator, and frontend as subprocesses.

    Yields a dict of base URLs. Tears down all processes on exit.
    Only used by tests marked ``@pytest.mark.live``.
    """
    processes: list[subprocess.Popen[bytes]] = []

    try:
        # 1. Factory first (orchestrator's health check verifies factory)
        factory_proc = subprocess.Popen(
            ["uv", "run", "uvicorn", "factory.server:create_app",
             "--factory", "--host", "0.0.0.0", "--port", str(FACTORY_PORT)],
            cwd=str(REPO_ROOT / "factory"),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
        )
        processes.append(factory_proc)

        if not _wait_for_health(FACTORY_URL):
            raise RuntimeError("Factory failed to start within timeout")

        # 2. Orchestrator second
        orchestrator_proc = subprocess.Popen(
            ["uv", "run", "uvicorn", "orchestrator.server:create_app",
             "--factory", "--host", "0.0.0.0", "--port", str(ORCHESTRATOR_PORT)],
            cwd=str(REPO_ROOT / "orchestrator"),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
        )
        processes.append(orchestrator_proc)

        if not _wait_for_health(ORCHESTRATOR_URL):
            raise RuntimeError("Orchestrator failed to start within timeout")

        # 3. Frontend last (Vite dev server)
        frontend_proc = subprocess.Popen(
            ["npx", "vite", "--port", str(FRONTEND_PORT), "--strictPort"],
            cwd=str(REPO_ROOT / "frontend"),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
        )
        processes.append(frontend_proc)

        # Wait for Vite dev server
        deadline = time.monotonic() + 30.0
        vite_ready = False
        while time.monotonic() < deadline:
            try:
                resp = httpx.get(FRONTEND_URL, timeout=5.0)
                if resp.status_code == 200:
                    vite_ready = True
                    break
            except httpx.ConnectError:
                pass
            time.sleep(0.5)

        if not vite_ready:
            raise RuntimeError("Frontend Vite dev server failed to start")

        yield {
            "orchestrator": ORCHESTRATOR_URL,
            "factory": FACTORY_URL,
            "frontend": FRONTEND_URL,
        }

    finally:
        for proc in reversed(processes):
            proc.terminate()
            try:
                proc.wait(timeout=10)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait(timeout=5)


@pytest.fixture()
def golden_path_events() -> list[dict]:
    """Load the golden-path fixture as a list of parsed event dicts.

    Used by default (non-live) tests for fixture replay.
    """
    fixture_path = FIXTURES_DIR / "golden-path.jsonl"
    events: list[dict] = []
    with fixture_path.open() as fh:
        for line in fh:
            line = line.strip()
            if line:
                events.append(json.loads(line))
    return events
