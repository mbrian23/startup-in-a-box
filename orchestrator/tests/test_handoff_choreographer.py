"""Tests for HandoffChoreographer.

Feeds synthetic SSE event sequences, asserts handoff_stage emissions
in ORDER (not just presence -- ordering is where cinematic bugs live),
asserts factory_progress is forwarded, and asserts error paths emit
"failed" before raising.
"""

from __future__ import annotations

import asyncio
import json
from typing import Any

import pytest

from orchestrator.settings import Settings
from orchestrator.sse.client import AgUiEvent
from orchestrator.tools.handoff import (
    FactoryConnectError,
    FactoryError,
    FactoryRunError,
    FactoryTimeoutError,
    HandoffChoreographer,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _event(event_type: str, **kwargs: Any) -> AgUiEvent:
    """Build a synthetic AgUiEvent matching the real factory SSE format.

    For STATE_DELTA events, kwargs are nested under a "delta" key
    to match the factory's _state_delta() output.
    """
    if event_type == "STATE_DELTA":
        data = {"type": event_type, "delta": kwargs}
    else:
        data = {"type": event_type, **kwargs}
    return AgUiEvent(type=event_type, data=data, raw=json.dumps(data))


class FakeSseClient:
    """Fake SseClient that yields canned events."""

    def __init__(self, events: list[AgUiEvent]) -> None:
        self._events = events

    async def stream_events(
        self, url: str, payload: dict[str, Any]
    ) -> Any:
        for event in self._events:
            yield event


class SlowFakeSseClient:
    """Fake SseClient that yields events with a delay to trigger idle timeout."""

    def __init__(self, events: list[AgUiEvent], delay: float) -> None:
        self._events = events
        self._delay = delay

    async def stream_events(
        self, url: str, payload: dict[str, Any]
    ) -> Any:
        for event in self._events:
            yield event
        # Simulate idle: hang after yielding all events without finishing
        await asyncio.sleep(self._delay)


class StateRecorder:
    """Records state emissions in order for assertion."""

    def __init__(self) -> None:
        self.emissions: list[dict[str, Any]] = []

    async def emit(self, state: dict[str, Any]) -> None:
        self.emissions.append(state)

    def values_for(self, key: str) -> list[Any]:
        """Extract all emitted values for a given key."""
        return [d[key] for d in self.emissions if key in d]


def _build_choreographer(
    sse_client: Any,
    recorder: StateRecorder,
    beat1_duration: float = 0.0,
    idle_timeout: int = 5,
) -> HandoffChoreographer:
    """Build a choreographer with test-friendly defaults."""
    return HandoffChoreographer(
        sse_client=sse_client,
        emit_state=recorder.emit,
        beat1_duration=beat1_duration,
        idle_timeout=idle_timeout,
    )


# ---------------------------------------------------------------------------
# Happy path
# ---------------------------------------------------------------------------


class TestHappyPath:
    """Synthetic factory: RUN_STARTED -> 5 STATE_DELTA{progress} -> RUN_FINISHED."""

    async def test_full_sequence_emits_correct_stages(self) -> None:
        events = [
            _event("RUN_STARTED", thread_id="t-1"),
            _event("STATE_DELTA", progress=0.1),
            _event("STATE_DELTA", progress=0.3),
            _event("STATE_DELTA", progress=0.5),
            _event("STATE_DELTA", progress=0.7),
            _event("STATE_DELTA", progress=0.9),
            _event("RUN_FINISHED", artifacts=["app.py", "main.py"]),
        ]
        recorder = StateRecorder()
        client = FakeSseClient(events)
        choreo = _build_choreographer(client, recorder)

        result = await choreo.execute("http://fake", {})

        # Verify stage ordering
        assert recorder.values_for("handoff_stage") == [
            "preparing",
            "launched",
            "returned",
        ]

        # Verify factory deltas forwarded (progress appears in each delta)
        progress_values = recorder.values_for("progress")
        assert progress_values == [0.1, 0.3, 0.5, 0.7, 0.9]

        # Verify return dict
        assert result["status"] == "shipped"
        assert result["factory_run_id"] == "t-1"
        assert result["artifacts_written"] == ["app.py", "main.py"]

    async def test_returns_shipped_dict(self) -> None:
        events = [
            _event("RUN_STARTED", thread_id="run-42"),
            _event("RUN_FINISHED", artifacts=["index.html"]),
        ]
        recorder = StateRecorder()
        choreo = _build_choreographer(FakeSseClient(events), recorder)
        result = await choreo.execute("http://fake", {})

        assert result == {
            "factory_run_id": "run-42",
            "artifacts_written": ["index.html"],
            "status": "shipped",
        }


# ---------------------------------------------------------------------------
# Delta forwarding: transparent relay
# ---------------------------------------------------------------------------


class TestDeltaForwarding:
    """STATE_DELTA events are forwarded as-is — the choreographer is a transparent relay."""

    async def test_all_factory_delta_fields_forwarded(self) -> None:
        events = [
            _event("RUN_STARTED", thread_id="t-1"),
            _event("STATE_DELTA", files={"a.py": {"status": "created", "size": 100}}),
            _event("STATE_DELTA", progress=0.5),
            _event("STATE_DELTA", hitl_pending=True),
            _event("STATE_DELTA", deployment_url="https://example.vercel.app"),
            _event("RUN_FINISHED", artifacts=[]),
        ]
        recorder = StateRecorder()
        choreo = _build_choreographer(FakeSseClient(events), recorder)
        await choreo.execute("http://fake", {})

        # All factory fields pass through without filtering
        assert recorder.values_for("progress") == [0.5]
        assert recorder.values_for("files") == [{"a.py": {"status": "created", "size": 100}}]
        assert recorder.values_for("deployment_url") == ["https://example.vercel.app"]
        assert recorder.values_for("hitl_pending") == [True]


# ---------------------------------------------------------------------------
# Error paths
# ---------------------------------------------------------------------------


class TestFactoryConnectError:
    """Factory unreachable -> FactoryConnectError, 'failed' emitted first."""

    async def test_connect_failure_emits_failed_then_raises(self) -> None:
        class FailingSseClient:
            async def stream_events(self, url: str, payload: dict) -> Any:
                raise ConnectionError("refused")
                yield  # make this an async generator  # noqa: RET503

        recorder = StateRecorder()
        choreo = _build_choreographer(FailingSseClient(), recorder)

        with pytest.raises(FactoryError):
            await choreo.execute("http://fake", {})

        stages = recorder.values_for("handoff_stage")
        assert "preparing" in stages
        assert stages[-1] == "failed"


class TestFactoryRunError:
    """Factory emits RUN_ERROR mid-stream -> FactoryRunError."""

    async def test_run_error_emits_failed_then_raises(self) -> None:
        events = [
            _event("RUN_STARTED", thread_id="t-1"),
            _event("STATE_DELTA", progress=0.2),
            _event("RUN_ERROR", message="OOM"),
        ]
        recorder = StateRecorder()
        choreo = _build_choreographer(FakeSseClient(events), recorder)

        with pytest.raises(FactoryRunError, match="OOM"):
            await choreo.execute("http://fake", {})

        assert recorder.values_for("handoff_stage")[-1] == "failed"


class TestFactoryTimeoutError:
    """SSE idle timeout -> FactoryTimeoutError, 'failed' emitted first."""

    async def test_idle_timeout_emits_failed_then_raises(self) -> None:
        events = [
            _event("RUN_STARTED", thread_id="t-1"),
        ]
        # Yields one event then hangs -- idle timeout of 1s will fire
        recorder = StateRecorder()
        choreo = _build_choreographer(
            SlowFakeSseClient(events, delay=10.0),
            recorder,
            idle_timeout=1,
        )

        with pytest.raises(FactoryTimeoutError):
            await choreo.execute("http://fake", {})

        assert recorder.values_for("handoff_stage")[-1] == "failed"


# ---------------------------------------------------------------------------
# Terminal event before "launched"
# ---------------------------------------------------------------------------


class TestEarlyTerminalEvent:
    """Factory returns RUN_ERROR before beat1 sleep elapses.

    The state machine must skip "launched" and go straight to "failed".
    """

    async def test_run_error_before_launched_skips_to_failed(self) -> None:
        events = [
            _event("RUN_ERROR", message="handshake failed"),
        ]
        recorder = StateRecorder()
        # Use a long beat1 duration to ensure we'd normally be sleeping
        choreo = _build_choreographer(
            FakeSseClient(events),
            recorder,
            beat1_duration=10.0,
        )

        with pytest.raises(FactoryRunError, match="handshake failed"):
            await choreo.execute("http://fake", {})

        stages = recorder.values_for("handoff_stage")
        assert stages == ["preparing", "failed"]


# ---------------------------------------------------------------------------
# Error hierarchy LSP
# ---------------------------------------------------------------------------


class TestErrorHierarchy:
    """All error subtypes are substitutable for FactoryError."""

    @pytest.mark.parametrize(
        "error_cls",
        [FactoryConnectError, FactoryRunError, FactoryTimeoutError],
    )
    def test_subtype_is_factory_error(self, error_cls: type) -> None:
        err = error_cls("test")
        assert isinstance(err, FactoryError)


# ---------------------------------------------------------------------------
# Boot-time invariant
# ---------------------------------------------------------------------------


class TestTimeoutInvariant:
    """Settings with factory_idle_timeout too low -> refusal."""

    def test_valid_settings_pass_invariant(self) -> None:
        settings = Settings(
            factory_idle_timeout_seconds=900,
            hitl_timeout_seconds=300,
        )
        settings.validate_timeout_invariant()  # should not raise

    def test_invalid_settings_fail_invariant(self) -> None:
        settings = Settings(
            factory_idle_timeout_seconds=100,
            hitl_timeout_seconds=300,
        )
        with pytest.raises(ValueError, match="factory_idle_timeout_seconds"):
            settings.validate_timeout_invariant()

    def test_invariant_boundary_exact_minimum(self) -> None:
        """Exact minimum: 300 * 2 + 120 = 720."""
        settings = Settings(
            factory_idle_timeout_seconds=720,
            hitl_timeout_seconds=300,
        )
        settings.validate_timeout_invariant()  # should not raise

    def test_invariant_boundary_one_below(self) -> None:
        settings = Settings(
            factory_idle_timeout_seconds=719,
            hitl_timeout_seconds=300,
        )
        with pytest.raises(ValueError):
            settings.validate_timeout_invariant()
