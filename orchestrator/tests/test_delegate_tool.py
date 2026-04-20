"""Tests for the delegate_to_factory ADK tool shim.

Tests the thin wiring layer against a fake choreographer -- verifies
payload construction, UUID generation, and result passthrough.
"""

from __future__ import annotations

import json
from typing import Any
from unittest.mock import AsyncMock, patch

import pytest

from orchestrator.settings import Settings
from orchestrator.tools.delegate import delegate_to_factory


class TestDelegateToFactory:
    """delegate_to_factory wires dependencies and returns choreographer result."""

    async def test_constructs_payload_with_fresh_uuids(self) -> None:
        """Each call generates unique thread_id and run_id."""
        captured_payloads: list[dict[str, Any]] = []

        async def fake_execute(
            factory_url: str, payload: dict[str, Any]
        ) -> dict[str, Any]:
            captured_payloads.append(payload)
            return {"factory_run_id": "x", "artifacts_written": [], "status": "shipped"}

        settings = Settings(
            factory_url="http://test:8888/factory",
            handoff_beat1_duration_seconds=0.0,
            factory_idle_timeout_seconds=900,
            hitl_timeout_seconds=300,
        )
        emitter = AsyncMock()
        build_plan = {"summary": "test plan", "steps": []}

        with patch(
            "orchestrator.tools.delegate.HandoffChoreographer"
        ) as mock_choreo_cls:
            mock_instance = AsyncMock()
            mock_instance.execute = fake_execute
            mock_choreo_cls.return_value = mock_instance

            result = await delegate_to_factory(build_plan, settings, emitter)

        assert result["status"] == "shipped"
        payload = captured_payloads[0]
        assert "thread_id" in payload
        assert "run_id" in payload
        assert payload["thread_id"] != payload["run_id"]
        assert payload["forwarded_props"]["build_plan"] == build_plan
        assert payload["messages"] == []

    async def test_returns_choreographer_result(self) -> None:
        expected = {
            "factory_run_id": "run-1",
            "artifacts_written": ["app.py"],
            "status": "shipped",
        }
        settings = Settings(
            factory_url="http://test:8888/factory",
            handoff_beat1_duration_seconds=0.0,
            factory_idle_timeout_seconds=900,
            hitl_timeout_seconds=300,
        )
        emitter = AsyncMock()

        with patch(
            "orchestrator.tools.delegate.HandoffChoreographer"
        ) as mock_choreo_cls:
            mock_instance = AsyncMock()
            mock_instance.execute.return_value = expected
            mock_choreo_cls.return_value = mock_instance

            result = await delegate_to_factory({"summary": "x", "steps": []}, settings, emitter)

        assert result == expected

    async def test_two_calls_get_different_thread_ids(self) -> None:
        """Fresh UUID per call -- no session reuse."""
        captured_payloads: list[dict[str, Any]] = []

        settings = Settings(
            factory_url="http://test:8888/factory",
            handoff_beat1_duration_seconds=0.0,
            factory_idle_timeout_seconds=900,
            hitl_timeout_seconds=300,
        )
        emitter = AsyncMock()

        with patch(
            "orchestrator.tools.delegate.HandoffChoreographer"
        ) as mock_choreo_cls:
            async def capture_execute(url: str, payload: dict) -> dict:
                captured_payloads.append(payload)
                return {"factory_run_id": "", "artifacts_written": [], "status": "shipped"}

            mock_instance = AsyncMock()
            mock_instance.execute = capture_execute
            mock_choreo_cls.return_value = mock_instance

            await delegate_to_factory({}, settings, emitter)
            await delegate_to_factory({}, settings, emitter)

        assert len(captured_payloads) == 2
        assert captured_payloads[0]["thread_id"] != captured_payloads[1]["thread_id"]
        assert captured_payloads[0]["run_id"] != captured_payloads[1]["run_id"]
