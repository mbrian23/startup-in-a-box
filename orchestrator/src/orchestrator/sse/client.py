"""SSE client for consuming AG-UI event streams from the factory.

Infrastructure layer: wraps httpx.AsyncClient.stream(), yields parsed
AgUiEvent objects. Knows nothing about the handoff choreography.

SRP: parse SSE bytes into typed events. No policy decisions.
DIP: callers depend on the AgUiEvent abstraction, not raw strings.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, AsyncIterator

import httpx


@dataclass(frozen=True)
class AgUiEvent:
    """A single AG-UI protocol event parsed from an SSE stream.

    Frozen value object -- immutable after creation.
    """

    type: str
    data: dict[str, Any] = field(default_factory=dict)
    raw: str = ""


def parse_sse_event(line: str) -> AgUiEvent | None:
    """Parse a single SSE ``data:`` line into an AgUiEvent.

    Returns None for comment lines, empty lines, or non-data fields.
    The AG-UI protocol sends one JSON object per ``data:`` line.
    """
    stripped = line.strip()
    if not stripped or stripped.startswith(":"):
        return None
    if not stripped.startswith("data:"):
        return None

    payload_str = stripped[len("data:"):].strip()
    if not payload_str:
        return None

    try:
        payload = json.loads(payload_str)
    except json.JSONDecodeError:
        return None

    event_type = payload.get("type", "")
    return AgUiEvent(type=event_type, data=payload, raw=payload_str)


class SseClient:
    """Streams AG-UI events from an HTTP SSE endpoint.

    Uses httpx.AsyncClient with timeout=None for the streaming call.
    Idle detection is handled externally by the caller (HandoffChoreographer)
    via asyncio.timeout around iteration.
    """

    def __init__(self, http_client: httpx.AsyncClient) -> None:
        self._http_client = http_client

    async def stream_events(
        self,
        url: str,
        payload: dict[str, Any],
    ) -> AsyncIterator[AgUiEvent]:
        """POST to the factory and yield parsed AgUiEvent objects.

        Raises httpx.ConnectError (or subclasses) if the factory is
        unreachable. The caller is responsible for mapping that to a
        domain error.
        """
        async with self._http_client.stream(
            "POST",
            url,
            json=payload,
            headers={"Accept": "text/event-stream"},
        ) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                event = parse_sse_event(line)
                if event is not None:
                    yield event
