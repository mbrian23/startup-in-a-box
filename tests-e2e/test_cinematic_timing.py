"""Cinematic timing assertions for the three-beat handoff.

Verifies the timing budget from the fixture:
  - Beat 1 total >= 1.4s (the deliberate pacing before "launched")
  - Beat 2 starts within 200ms of Beat 1's "launched"
  - Beat 3 fires within 500ms of factory RUN_FINISHED

These are loose upper bounds and tight lower bounds where the cinematic
needs breathing room. The test operates on the golden-path fixture
timestamps in default mode.
"""

from __future__ import annotations

from datetime import datetime

import pytest


def _parse_ts(ts_str: str) -> datetime:
    """Parse an ISO timestamp, handling optional fractional seconds."""
    for fmt in ("%Y-%m-%dT%H:%M:%S.%fZ", "%Y-%m-%dT%H:%M:%SZ"):
        try:
            return datetime.strptime(ts_str, fmt)
        except ValueError:
            continue
    raise ValueError(f"Cannot parse timestamp: {ts_str}")


def _find_handoff_stage(events: list[dict], stage: str) -> dict | None:
    """Find the STATE_DELTA event that sets handoff_stage to the given value."""
    for event in events:
        if event["type"] == "STATE_DELTA":
            delta = event.get("delta", {})
            if delta.get("handoff_stage") == stage:
                return event
    return None


def _find_event(events: list[dict], event_type: str, **kwargs: object) -> dict | None:
    """Find first event matching type and optional field filters."""
    for event in events:
        if event["type"] == event_type:
            if all(event.get(k) == v for k, v in kwargs.items()):
                return event
    return None


class TestCinematicTiming:
    """Beat timing assertions from the golden-path fixture."""

    def test_beat1_duration_at_least_1400ms(
        self, golden_path_events: list[dict]
    ) -> None:
        """Beat 1 (preparing -> launched) must take >= 1.4 seconds.

        This is the deliberate pacing that gives the audience time to
        register the handoff animation before the factory screen activates.
        """
        preparing = _find_handoff_stage(golden_path_events, "preparing")
        launched = _find_handoff_stage(golden_path_events, "launched")

        assert preparing is not None, "No 'preparing' handoff_stage found"
        assert launched is not None, "No 'launched' handoff_stage found"

        preparing_ts = _parse_ts(preparing["timestamp"])
        launched_ts = _parse_ts(launched["timestamp"])
        duration_ms = (launched_ts - preparing_ts).total_seconds() * 1000

        assert duration_ms >= 1400, (
            f"Beat 1 duration {duration_ms:.0f}ms is below 1400ms minimum"
        )

    def test_beat2_starts_within_200ms_of_launched(
        self, golden_path_events: list[dict]
    ) -> None:
        """Beat 2 (factory RUN_STARTED) fires within 200ms of 'launched'."""
        launched = _find_handoff_stage(golden_path_events, "launched")
        factory_start = _find_event(
            golden_path_events, "RUN_STARTED", source="factory"
        )

        assert launched is not None, "No 'launched' handoff_stage found"
        assert factory_start is not None, "No factory RUN_STARTED found"

        launched_ts = _parse_ts(launched["timestamp"])
        factory_ts = _parse_ts(factory_start["timestamp"])
        gap_ms = (factory_ts - launched_ts).total_seconds() * 1000

        assert gap_ms <= 200, (
            f"Beat 2 gap {gap_ms:.0f}ms exceeds 200ms budget"
        )

    def test_beat3_fires_within_500ms_of_factory_finish(
        self, golden_path_events: list[dict]
    ) -> None:
        """Beat 3 ('returned') fires within 500ms of factory RUN_FINISHED."""
        factory_finish = _find_event(
            golden_path_events, "RUN_FINISHED", source="factory"
        )
        returned = _find_handoff_stage(golden_path_events, "returned")

        assert factory_finish is not None, "No factory RUN_FINISHED found"
        assert returned is not None, "No 'returned' handoff_stage found"

        factory_ts = _parse_ts(factory_finish["timestamp"])
        returned_ts = _parse_ts(returned["timestamp"])
        gap_ms = (returned_ts - factory_ts).total_seconds() * 1000

        assert gap_ms <= 500, (
            f"Beat 3 gap {gap_ms:.0f}ms exceeds 500ms budget"
        )
