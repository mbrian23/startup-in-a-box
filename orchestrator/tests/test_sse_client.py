"""Tests for SSE client: parse_sse_event and SseClient.

Covers every AG-UI event type round-trip, edge cases for malformed
lines, and the async streaming interface via a fake HTTP transport.
"""

from __future__ import annotations

import json

import pytest

from orchestrator.sse.client import AgUiEvent, SseClient, parse_sse_event


# ---------------------------------------------------------------------------
# parse_sse_event unit tests
# ---------------------------------------------------------------------------


class TestParseSseEvent:
    """parse_sse_event must handle every AG-UI event type and edge case."""

    def test_run_started(self) -> None:
        payload = {"type": "RUN_STARTED", "thread_id": "t-1"}
        line = f"data: {json.dumps(payload)}"
        event = parse_sse_event(line)
        assert event is not None
        assert event.type == "RUN_STARTED"
        assert event.data["thread_id"] == "t-1"

    def test_run_finished(self) -> None:
        payload = {"type": "RUN_FINISHED", "artifacts": ["app.py"]}
        line = f"data: {json.dumps(payload)}"
        event = parse_sse_event(line)
        assert event is not None
        assert event.type == "RUN_FINISHED"

    def test_run_error(self) -> None:
        payload = {"type": "RUN_ERROR", "message": "boom"}
        line = f"data: {json.dumps(payload)}"
        event = parse_sse_event(line)
        assert event is not None
        assert event.type == "RUN_ERROR"
        assert event.data["message"] == "boom"

    def test_state_delta_with_progress(self) -> None:
        payload = {"type": "STATE_DELTA", "progress": 0.5}
        line = f"data: {json.dumps(payload)}"
        event = parse_sse_event(line)
        assert event is not None
        assert event.type == "STATE_DELTA"
        assert event.data["progress"] == 0.5

    def test_state_delta_without_progress(self) -> None:
        payload = {"type": "STATE_DELTA", "files": ["a.py"]}
        line = f"data: {json.dumps(payload)}"
        event = parse_sse_event(line)
        assert event is not None
        assert event.type == "STATE_DELTA"
        assert "progress" not in event.data

    def test_tool_call_start(self) -> None:
        payload = {"type": "TOOL_CALL_START", "tool": "write"}
        event = parse_sse_event(f"data: {json.dumps(payload)}")
        assert event is not None
        assert event.type == "TOOL_CALL_START"

    def test_tool_call_end(self) -> None:
        payload = {"type": "TOOL_CALL_END", "tool": "write"}
        event = parse_sse_event(f"data: {json.dumps(payload)}")
        assert event is not None
        assert event.type == "TOOL_CALL_END"

    def test_text_message_start(self) -> None:
        payload = {"type": "TEXT_MESSAGE_START", "message_id": "m1"}
        event = parse_sse_event(f"data: {json.dumps(payload)}")
        assert event is not None
        assert event.type == "TEXT_MESSAGE_START"

    def test_text_message_content(self) -> None:
        payload = {"type": "TEXT_MESSAGE_CONTENT", "delta": "hello"}
        event = parse_sse_event(f"data: {json.dumps(payload)}")
        assert event is not None
        assert event.type == "TEXT_MESSAGE_CONTENT"

    def test_text_message_end(self) -> None:
        payload = {"type": "TEXT_MESSAGE_END", "message_id": "m1"}
        event = parse_sse_event(f"data: {json.dumps(payload)}")
        assert event is not None
        assert event.type == "TEXT_MESSAGE_END"

    def test_empty_line_returns_none(self) -> None:
        assert parse_sse_event("") is None

    def test_comment_line_returns_none(self) -> None:
        assert parse_sse_event(": keep-alive") is None

    def test_non_data_field_returns_none(self) -> None:
        assert parse_sse_event("event: message") is None

    def test_malformed_json_returns_none(self) -> None:
        assert parse_sse_event("data: {not json}") is None

    def test_data_with_no_payload_returns_none(self) -> None:
        assert parse_sse_event("data:") is None

    def test_data_with_whitespace_only_returns_none(self) -> None:
        assert parse_sse_event("data:   ") is None

    def test_preserves_raw_payload(self) -> None:
        payload = {"type": "RUN_STARTED", "thread_id": "t-1"}
        raw_str = json.dumps(payload)
        event = parse_sse_event(f"data: {raw_str}")
        assert event is not None
        assert event.raw == raw_str

    def test_event_is_frozen(self) -> None:
        payload = {"type": "RUN_STARTED"}
        event = parse_sse_event(f"data: {json.dumps(payload)}")
        assert event is not None
        with pytest.raises(AttributeError):
            event.type = "changed"  # type: ignore[misc]


# ---------------------------------------------------------------------------
# SseClient integration test with fake transport
# ---------------------------------------------------------------------------


class FakeAsyncLineIterator:
    """Simulates httpx response.aiter_lines()."""

    def __init__(self, lines: list[str]) -> None:
        self._lines = lines
        self._index = 0

    def __aiter__(self) -> FakeAsyncLineIterator:
        return self

    async def __anext__(self) -> str:
        if self._index >= len(self._lines):
            raise StopAsyncIteration
        line = self._lines[self._index]
        self._index += 1
        return line


class FakeResponse:
    """Minimal fake for httpx streaming response."""

    def __init__(self, lines: list[str]) -> None:
        self._lines = lines
        self.status_code = 200

    def raise_for_status(self) -> None:
        pass

    def aiter_lines(self) -> FakeAsyncLineIterator:
        return FakeAsyncLineIterator(self._lines)

    async def __aenter__(self) -> FakeResponse:
        return self

    async def __aexit__(self, *args: object) -> None:
        pass


class FakeHttpClient:
    """Minimal fake for httpx.AsyncClient that returns canned SSE lines."""

    def __init__(self, lines: list[str]) -> None:
        self._response = FakeResponse(lines)

    def stream(self, *args: object, **kwargs: object) -> FakeResponse:
        return self._response


class TestSseClient:
    """SseClient yields parsed AgUiEvent objects from an SSE stream."""

    async def test_streams_events_from_factory(self) -> None:
        lines = [
            f'data: {json.dumps({"type": "RUN_STARTED", "thread_id": "t-1"})}',
            f'data: {json.dumps({"type": "STATE_DELTA", "progress": 0.5})}',
            ": keep-alive",
            f'data: {json.dumps({"type": "RUN_FINISHED", "artifacts": []})}',
        ]
        client = SseClient(FakeHttpClient(lines))  # type: ignore[arg-type]
        events: list[AgUiEvent] = []
        async for event in client.stream_events("http://fake", {}):
            events.append(event)

        assert len(events) == 3
        assert events[0].type == "RUN_STARTED"
        assert events[1].type == "STATE_DELTA"
        assert events[2].type == "RUN_FINISHED"

    async def test_skips_non_data_lines(self) -> None:
        lines = [
            ": comment",
            "",
            "event: ping",
            f'data: {json.dumps({"type": "RUN_STARTED"})}',
        ]
        client = SseClient(FakeHttpClient(lines))  # type: ignore[arg-type]
        events = [e async for e in client.stream_events("http://fake", {})]
        assert len(events) == 1
        assert events[0].type == "RUN_STARTED"
