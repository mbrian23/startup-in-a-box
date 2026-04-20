"""Per-thread broker between the transcript tailer and the SSE endpoint.

One factory run per ``thread_id``, but multiple browser windows might
subscribe to the same run — or different runs at the same time — so
the broker is a registry keyed by ``thread_id``. Each thread has its
own fan-out queue set and an on-demand replay buffer so a window that
connects mid-run still sees the history.

Envelopes match the vendored agent-flow webview's
``window.postMessage`` contract; the frontend relay is a pass-through.
"""

from __future__ import annotations

import asyncio
import json
import logging
from collections import deque
from typing import Any, AsyncIterator, Deque

logger = logging.getLogger(__name__)

_QUEUE_MAXSIZE = 512
_REPLAY_BUFFER_MAXSIZE = 2048


class _ThreadBroker:
    """Fan-out + replay buffer for one ``thread_id``."""

    def __init__(self, thread_id: str) -> None:
        self.thread_id = thread_id
        self._subscribers: set[asyncio.Queue[dict[str, Any]]] = set()
        # Replay buffer lets a window that connects mid-run catch up
        # without racing the live stream. Capped so long idle brokers
        # don't grow unbounded.
        self._replay: Deque[dict[str, Any]] = deque(maxlen=_REPLAY_BUFFER_MAXSIZE)
        # Set by ``release_broker`` when the run has finished. We keep
        # the broker alive while subscribers are still attached so
        # replay keeps working, then drop it when the last one leaves.
        self.run_ended = False

    def subscribe(self) -> tuple[asyncio.Queue[dict[str, Any]], list[dict[str, Any]]]:
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=_QUEUE_MAXSIZE)
        self._subscribers.add(queue)
        return queue, list(self._replay)

    def unsubscribe(self, queue: asyncio.Queue[dict[str, Any]]) -> None:
        self._subscribers.discard(queue)

    def subscriber_count(self) -> int:
        return len(self._subscribers)

    def publish(self, envelope: dict[str, Any]) -> None:
        self._replay.append(envelope)
        # Never block the publisher — the tailer runs on the event loop
        # and must not stall on a slow subscriber. Drop oldest on overflow.
        for queue in list(self._subscribers):
            try:
                queue.put_nowait(envelope)
            except asyncio.QueueFull:
                try:
                    queue.get_nowait()
                    queue.put_nowait(envelope)
                except Exception:
                    logger.warning(
                        "agent-flow[%s]: dropped event for slow subscriber",
                        self.thread_id,
                    )


_registry: dict[str, _ThreadBroker] = {}
_registry_lock = asyncio.Lock()


def _get_broker(thread_id: str) -> _ThreadBroker:
    broker = _registry.get(thread_id)
    if broker is None:
        broker = _ThreadBroker(thread_id)
        _registry[thread_id] = broker
    return broker


# ─── Publish API ────────────────────────────────────────────────────────────


def publish_session_started(
    thread_id: str,
    session_id: str,
    label: str,
    start_time_ms: int,
) -> None:
    _get_broker(thread_id).publish(
        {
            "type": "session-started",
            "session": {
                "id": session_id,
                "label": label,
                "status": "active",
                "startTime": start_time_ms,
                "lastActivityTime": start_time_ms,
            },
        },
    )


def publish_session_updated(thread_id: str, session_id: str, label: str) -> None:
    _get_broker(thread_id).publish(
        {"type": "session-updated", "sessionId": session_id, "label": label},
    )


def publish_session_ended(thread_id: str, session_id: str) -> None:
    _get_broker(thread_id).publish({"type": "session-ended", "sessionId": session_id})


def publish_agent_event(thread_id: str, event: dict[str, Any]) -> None:
    """Publish a simulation-shape event.

    Expected keys in ``event``: ``time``, ``type``, ``payload``,
    optional ``sessionId`` (matches ``SimulationEvent`` on the frontend).
    """
    _get_broker(thread_id).publish({"type": "agent-event", "event": event})


async def release_broker(thread_id: str) -> None:
    """Mark a run as finished and drop its broker when idle.

    Called from the runner when a factory run finishes. If no windows
    are attached we drop immediately; otherwise we flag the broker so
    the last unsubscribe path can clean up.
    """
    async with _registry_lock:
        broker = _registry.get(thread_id)
        if broker is None:
            return
        broker.run_ended = True
        if broker.subscriber_count() == 0:
            _registry.pop(thread_id, None)


async def _release_if_idle(broker: _ThreadBroker) -> None:
    async with _registry_lock:
        if broker.run_ended and broker.subscriber_count() == 0:
            _registry.pop(broker.thread_id, None)


# ─── SSE stream ─────────────────────────────────────────────────────────────


async def sse_stream(thread_id: str) -> AsyncIterator[str]:
    """Subscribe to ``thread_id`` and yield SSE-formatted lines.

    On connect, any buffered envelopes for the thread are replayed
    before live events resume — windows that attach mid-run still get
    the full session history.
    """
    broker = _get_broker(thread_id)
    queue, replay = broker.subscribe()
    try:
        # Prime the connection so the browser's EventSource reports open.
        yield ": connected\n\n"
        for envelope in replay:
            yield f"data: {json.dumps(envelope)}\n\n"
        while True:
            envelope = await queue.get()
            yield f"data: {json.dumps(envelope)}\n\n"
    finally:
        broker.unsubscribe(queue)
        await _release_if_idle(broker)
