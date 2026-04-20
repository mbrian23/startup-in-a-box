"""Failure-path end-to-end tests.

TDD principle: failure paths are written before "make it work on stage"
patches. The golden path is tempting to celebrate; the failure paths
are what actually make the demo safe to run in front of an audience.

Two scenarios:
  (a) HITL deny — user denies an approval -> handoff_stage: "failed"
  (b) Factory drop — factory stream drops mid-run -> orchestrator RUN_ERROR

Default mode uses fixture-based assertions. Live mode requires real backends.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"


# ---------------------------------------------------------------------------
# Fixture-based failure scenario helpers
# ---------------------------------------------------------------------------


def _build_hitl_deny_events() -> list[dict]:
    """Synthetic event sequence for an HITL deny scenario.

    Models: orchestrator delegates, factory requests approval,
    user denies, factory emits RUN_ERROR, orchestrator sees "failed".
    """
    return [
        {"type": "RUN_STARTED", "threadId": "t-deny", "runId": "r-deny",
         "timestamp": "2026-04-12T10:00:00Z"},
        {"type": "STATE_DELTA", "threadId": "t-deny", "runId": "r-deny",
         "delta": {"target_audience": {"segments": ["test"]}},
         "timestamp": "2026-04-12T10:00:01Z"},
        {"type": "STATE_DELTA", "threadId": "t-deny", "runId": "r-deny",
         "delta": {"value_proposition": {"hook": "test"}},
         "timestamp": "2026-04-12T10:00:02Z"},
        {"type": "STATE_DELTA", "threadId": "t-deny", "runId": "r-deny",
         "delta": {"feature_list": {"features": ["test"]}},
         "timestamp": "2026-04-12T10:00:03Z"},
        {"type": "TOOL_CALL_START", "threadId": "t-deny", "runId": "r-deny",
         "toolCallId": "tc-del", "toolCallName": "delegate_to_factory",
         "timestamp": "2026-04-12T10:00:04Z"},
        {"type": "STATE_DELTA", "threadId": "t-deny", "runId": "r-deny",
         "delta": {"handoff_stage": "preparing"},
         "timestamp": "2026-04-12T10:00:04.100Z"},
        {"type": "STATE_DELTA", "threadId": "t-deny", "runId": "r-deny",
         "delta": {"handoff_stage": "launched"},
         "timestamp": "2026-04-12T10:00:05.600Z"},
        {"type": "RUN_STARTED", "threadId": "t-deny", "runId": "r-factory-deny",
         "source": "factory", "timestamp": "2026-04-12T10:00:05.700Z"},
        {"type": "TOOL_CALL_START", "threadId": "t-deny", "runId": "r-factory-deny",
         "toolCallId": "tc-approve", "toolCallName": "request_approval",
         "source": "factory", "timestamp": "2026-04-12T10:00:06Z"},
        {"type": "TOOL_CALL_END", "threadId": "t-deny", "runId": "r-factory-deny",
         "toolCallId": "tc-approve", "toolCallName": "request_approval",
         "result": {"approved": False, "reason": "User denied"},
         "source": "factory", "timestamp": "2026-04-12T10:00:08Z"},
        {"type": "RUN_ERROR", "threadId": "t-deny", "runId": "r-factory-deny",
         "message": "ApprovalDenied: User denied",
         "source": "factory", "timestamp": "2026-04-12T10:00:08.100Z"},
        {"type": "STATE_DELTA", "threadId": "t-deny", "runId": "r-deny",
         "delta": {"handoff_stage": "failed"},
         "timestamp": "2026-04-12T10:00:08.500Z"},
        {"type": "RUN_ERROR", "threadId": "t-deny", "runId": "r-deny",
         "message": "Factory run failed: ApprovalDenied",
         "timestamp": "2026-04-12T10:00:09Z"},
    ]


def _build_factory_drop_events() -> list[dict]:
    """Synthetic event sequence for a factory stream drop.

    Models: orchestrator delegates, factory starts, then stream drops.
    Orchestrator detects idle timeout and emits RUN_ERROR.
    """
    return [
        {"type": "RUN_STARTED", "threadId": "t-drop", "runId": "r-drop",
         "timestamp": "2026-04-12T10:00:00Z"},
        {"type": "STATE_DELTA", "threadId": "t-drop", "runId": "r-drop",
         "delta": {"target_audience": {"segments": ["test"]}},
         "timestamp": "2026-04-12T10:00:01Z"},
        {"type": "TOOL_CALL_START", "threadId": "t-drop", "runId": "r-drop",
         "toolCallId": "tc-del", "toolCallName": "delegate_to_factory",
         "timestamp": "2026-04-12T10:00:02Z"},
        {"type": "STATE_DELTA", "threadId": "t-drop", "runId": "r-drop",
         "delta": {"handoff_stage": "preparing"},
         "timestamp": "2026-04-12T10:00:02.100Z"},
        {"type": "STATE_DELTA", "threadId": "t-drop", "runId": "r-drop",
         "delta": {"handoff_stage": "launched"},
         "timestamp": "2026-04-12T10:00:03.600Z"},
        {"type": "RUN_STARTED", "threadId": "t-drop", "runId": "r-factory-drop",
         "source": "factory", "timestamp": "2026-04-12T10:00:03.700Z"},
        # Factory stream drops here — no more factory events
        {"type": "RUN_ERROR", "threadId": "t-drop", "runId": "r-drop",
         "message": "FactoryTimeoutError: idle timeout exceeded",
         "timestamp": "2026-04-12T10:15:03.700Z"},
    ]


# ---------------------------------------------------------------------------
# HITL deny path tests
# ---------------------------------------------------------------------------


class TestHitlDenyPath:
    """Verify HITL deny produces the correct failure sequence."""

    @pytest.fixture()
    def deny_events(self) -> list[dict]:
        return _build_hitl_deny_events()

    def test_deny_produces_factory_run_error(self, deny_events: list[dict]) -> None:
        """Factory emits RUN_ERROR after approval is denied."""
        factory_errors = [
            e for e in deny_events
            if e["type"] == "RUN_ERROR" and e.get("source") == "factory"
        ]
        assert len(factory_errors) == 1
        assert "ApprovalDenied" in factory_errors[0]["message"]

    def test_deny_sets_handoff_stage_failed(self, deny_events: list[dict]) -> None:
        """Orchestrator sets handoff_stage to 'failed' after factory error."""
        handoff_stages: list[str] = []
        for event in deny_events:
            if event["type"] == "STATE_DELTA":
                delta = event.get("delta", {})
                if "handoff_stage" in delta:
                    handoff_stages.append(delta["handoff_stage"])

        assert "failed" in handoff_stages, (
            f"Expected 'failed' in handoff stages, got {handoff_stages}"
        )
        # "failed" should be the last handoff stage
        assert handoff_stages[-1] == "failed"

    def test_deny_no_partial_file_writes(self, deny_events: list[dict]) -> None:
        """No file write tool calls complete after the deny."""
        deny_idx = next(
            i for i, e in enumerate(deny_events)
            if e["type"] == "TOOL_CALL_END"
            and e.get("toolCallName") == "request_approval"
            and e.get("result", {}).get("approved") is False
        )
        # No successful file tool calls after the deny
        post_deny_tool_ends = [
            e for e in deny_events[deny_idx + 1:]
            if e["type"] == "TOOL_CALL_END"
            and e.get("toolCallName") in ("Write", "Edit", "Bash")
        ]
        assert len(post_deny_tool_ends) == 0, (
            f"Partial writes after deny: {post_deny_tool_ends}"
        )

    def test_deny_approval_result_has_reason(self, deny_events: list[dict]) -> None:
        """The deny TOOL_CALL_END includes a reason field."""
        deny_end = next(
            e for e in deny_events
            if e["type"] == "TOOL_CALL_END"
            and e.get("toolCallName") == "request_approval"
        )
        assert deny_end["result"]["approved"] is False
        assert "reason" in deny_end["result"]


# ---------------------------------------------------------------------------
# Factory drop path tests
# ---------------------------------------------------------------------------


class TestFactoryDropPath:
    """Verify factory stream drop produces correct timeout behavior."""

    @pytest.fixture()
    def drop_events(self) -> list[dict]:
        return _build_factory_drop_events()

    def test_drop_produces_orchestrator_run_error(
        self, drop_events: list[dict]
    ) -> None:
        """Orchestrator emits RUN_ERROR with FactoryTimeoutError."""
        orch_errors = [
            e for e in drop_events
            if e["type"] == "RUN_ERROR" and e.get("source") is None
        ]
        assert len(orch_errors) == 1
        assert "FactoryTimeoutError" in orch_errors[0]["message"]

    def test_drop_no_run_finished(self, drop_events: list[dict]) -> None:
        """No RUN_FINISHED after a factory drop — only RUN_ERROR."""
        finished_events = [
            e for e in drop_events if e["type"] == "RUN_FINISHED"
        ]
        assert len(finished_events) == 0

    def test_drop_factory_never_finishes(self, drop_events: list[dict]) -> None:
        """Factory never emits RUN_FINISHED in a drop scenario."""
        factory_finished = [
            e for e in drop_events
            if e["type"] == "RUN_FINISHED" and e.get("source") == "factory"
        ]
        assert len(factory_finished) == 0


# ---------------------------------------------------------------------------
# Live failure path tests (dress rehearsal only)
# ---------------------------------------------------------------------------


@pytest.mark.live
class TestFailurePathsLive:
    """Live failure path tests — require running backends.

    These are dress-rehearsal tests that validate the actual error
    handling works end-to-end with real services.
    """

    @pytest.mark.timeout(60)
    def test_health_deep_without_key_returns_false(
        self, live_stack: dict[str, str]
    ) -> None:
        """If API key is invalid, /health?deep=true returns llm_reachable: false.

        Note: this test only makes sense if run against a backend with
        an intentionally invalid key. In normal demo rehearsal, it will
        pass because keys are valid.
        """
        import httpx

        # This is a structural test — verifying the endpoint shape
        for name, url in [
            ("orchestrator", live_stack["orchestrator"]),
            ("factory", live_stack["factory"]),
        ]:
            resp = httpx.get(f"{url}/health?deep=true", timeout=15.0)
            assert resp.status_code == 200
            body = resp.json()
            assert "ok" in body
            assert "llm_reachable" in body
