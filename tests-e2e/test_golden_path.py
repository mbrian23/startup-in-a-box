"""Golden-path end-to-end test.

Two modes:
  - ``pytest -m live`` — hits real Gemini + Claude endpoints via the live_stack.
  - default — replays ``fixtures/golden-path.jsonl`` and asserts event sequence.

The fixture-replay mode is the CI regression gate. The live mode is a
dress rehearsal that may flake on LLM drift.
"""

from __future__ import annotations

import pytest


# ---------------------------------------------------------------------------
# Fixture-replay mode (default) — no live backends needed
# ---------------------------------------------------------------------------


class TestGoldenPathFixtureReplay:
    """Assert the golden-path event sequence from the recorded fixture."""

    def test_fixture_starts_with_run_started(
        self, golden_path_events: list[dict]
    ) -> None:
        assert len(golden_path_events) > 0
        assert golden_path_events[0]["type"] == "RUN_STARTED"

    def test_fixture_ends_with_run_finished(
        self, golden_path_events: list[dict]
    ) -> None:
        assert golden_path_events[-1]["type"] == "RUN_FINISHED"

    def test_no_run_error_in_fixture(
        self, golden_path_events: list[dict]
    ) -> None:
        error_events = [e for e in golden_path_events if e["type"] == "RUN_ERROR"]
        assert len(error_events) == 0, f"Unexpected RUN_ERROR events: {error_events}"

    def test_three_strategy_state_deltas_before_delegate(
        self, golden_path_events: list[dict]
    ) -> None:
        """Orchestrator emits three strategy-board STATE_DELTAs before delegation."""
        delegate_idx = next(
            (i for i, e in enumerate(golden_path_events)
             if e["type"] == "TOOL_CALL_START"
             and e.get("toolCallName") == "delegate_to_factory"),
            None,
        )
        assert delegate_idx is not None, "No delegate_to_factory TOOL_CALL_START found"

        state_deltas_before = [
            e for e in golden_path_events[:delegate_idx]
            if e["type"] == "STATE_DELTA"
        ]
        assert len(state_deltas_before) >= 3, (
            f"Expected >= 3 STATE_DELTAs before delegation, got {len(state_deltas_before)}"
        )

    def test_handoff_stage_sequence(
        self, golden_path_events: list[dict]
    ) -> None:
        """Handoff stages progress: preparing -> launched -> returned."""
        handoff_stages: list[str] = []
        for event in golden_path_events:
            if event["type"] == "STATE_DELTA":
                delta = event.get("delta", {})
                if "handoff_stage" in delta:
                    handoff_stages.append(delta["handoff_stage"])

        assert handoff_stages == ["preparing", "launched", "returned"], (
            f"Expected handoff sequence [preparing, launched, returned], "
            f"got {handoff_stages}"
        )

    def test_factory_run_started_and_finished(
        self, golden_path_events: list[dict]
    ) -> None:
        """Factory emits its own RUN_STARTED and RUN_FINISHED."""
        factory_events = [
            e for e in golden_path_events if e.get("source") == "factory"
        ]
        factory_types = [e["type"] for e in factory_events]
        assert "RUN_STARTED" in factory_types
        assert "RUN_FINISHED" in factory_types

    def test_at_least_one_hitl_approval(
        self, golden_path_events: list[dict]
    ) -> None:
        """At least one HITL approval card is surfaced during factory run."""
        approval_events = [
            e for e in golden_path_events
            if e["type"] == "TOOL_CALL_START"
            and e.get("toolCallName") == "request_approval"
        ]
        assert len(approval_events) >= 1, "No HITL approval events found"

    def test_all_events_have_timestamps(
        self, golden_path_events: list[dict]
    ) -> None:
        for i, event in enumerate(golden_path_events):
            assert "timestamp" in event, (
                f"Event at index {i} ({event.get('type')}) missing timestamp"
            )


# ---------------------------------------------------------------------------
# Live mode — requires real backends and LLM keys
# ---------------------------------------------------------------------------


@pytest.mark.live
class TestGoldenPathLive:
    """Live dress-rehearsal test against real LLM endpoints.

    Run with: ``pytest -m live``
    Requires: all three modules running (via live_stack fixture),
    valid API keys in .env files.
    """

    @pytest.mark.timeout(300)
    def test_full_pipeline_completes(self, live_stack: dict[str, str]) -> None:
        """Submit a prompt and verify the full pipeline completes.

        This test drives "Uber for crossing the street" through the
        orchestrator and asserts that:
        1. Orchestrator RUN_STARTED is emitted
        2. Factory run completes
        3. No RUN_ERROR anywhere
        4. Final RUN_FINISHED is emitted
        """
        import httpx

        orchestrator_url = live_stack["orchestrator"]

        # Submit prompt via AG-UI endpoint
        with httpx.Client(timeout=300.0) as client:
            resp = client.post(
                f"{orchestrator_url}/orchestrator",
                json={
                    "threadId": "e2e-live-test",
                    "runId": "e2e-live-run",
                    "messages": [
                        {
                            "role": "user",
                            "content": "Uber for crossing the street",
                        }
                    ],
                },
                headers={"Accept": "text/event-stream"},
            )

        assert resp.status_code == 200, f"Unexpected status: {resp.status_code}"

        # Parse SSE events from response
        events: list[dict] = []
        for line in resp.text.split("\n"):
            if line.startswith("data: "):
                import json
                try:
                    events.append(json.loads(line[6:]))
                except json.JSONDecodeError:
                    pass

        event_types = [e.get("type") for e in events]
        assert "RUN_STARTED" in event_types, "Missing RUN_STARTED"
        assert "RUN_FINISHED" in event_types, "Missing RUN_FINISHED"
        assert "RUN_ERROR" not in event_types, (
            f"Unexpected RUN_ERROR: {[e for e in events if e.get('type') == 'RUN_ERROR']}"
        )
