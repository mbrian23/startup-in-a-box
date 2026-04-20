"""Per-thread broker for the factory's AG-UI SSE stream.

``/factory`` is one-shot — it runs the Claude SDK and yields SSE chunks
to a single HTTP consumer. A browser refresh loses that connection even
though the SDK subprocess keeps running (or used to, before cancel was
wired through). This broker lets a future GET /factory/resume attach
to the live run: it buffers each emitted chunk per thread_id and
fan-outs to late subscribers with replay.

Separate from ``agent_flow_events`` — that one carries agent-flow
visualizer envelopes sourced from the transcript tailer; this one
carries AG-UI protocol chunks produced by ``run_build_plan_stream``.
"""

from __future__ import annotations

import asyncio
import logging
from collections import deque
from typing import AsyncIterator, Deque

logger = logging.getLogger(__name__)

# Enough headroom to buffer a full factory run's progress deltas without
# retaining so much that long idle brokers balloon. A typical run emits
# a few hundred chunks; 4k leaves room for verbose builds.
_REPLAY_MAX = 4096
_QUEUE_MAX = 512


class _ThreadStream:
    """Single-writer, many-reader replay buffer for one thread_id."""

    def __init__(self, thread_id: str) -> None:
        self.thread_id = thread_id
        self._replay: Deque[str] = deque(maxlen=_REPLAY_MAX)
        self._subscribers: set[asyncio.Queue[str | None]] = set()
        self._ended = False

    @property
    def ended(self) -> bool:
        return self._ended

    def publish(self, chunk: str) -> None:
        self._replay.append(chunk)
        for queue in list(self._subscribers):
            try:
                queue.put_nowait(chunk)
            except asyncio.QueueFull:
                try:
                    queue.get_nowait()
                    queue.put_nowait(chunk)
                except Exception:
                    logger.warning(
                        "factory-event-broker[%s]: dropped for slow subscriber",
                        self.thread_id,
                    )

    def end(self) -> None:
        if self._ended:
            return
        self._ended = True
        # Wake every subscriber so their generators can exit cleanly
        # instead of blocking forever on the queue.
        for queue in list(self._subscribers):
            try:
                queue.put_nowait(None)
            except asyncio.QueueFull:
                pass

    def subscribe(self) -> tuple[asyncio.Queue[str | None], list[str], bool]:
        queue: asyncio.Queue[str | None] = asyncio.Queue(maxsize=_QUEUE_MAX)
        self._subscribers.add(queue)
        return queue, list(self._replay), self._ended

    def unsubscribe(self, queue: asyncio.Queue[str | None]) -> None:
        self._subscribers.discard(queue)

    def subscriber_count(self) -> int:
        return len(self._subscribers)


_registry: dict[str, _ThreadStream] = {}
_registry_lock = asyncio.Lock()


def _get_or_create(thread_id: str) -> _ThreadStream:
    stream = _registry.get(thread_id)
    if stream is None:
        stream = _ThreadStream(thread_id)
        _registry[thread_id] = stream
    return stream


def is_active(thread_id: str) -> bool:
    """True if a (not-yet-ended) broker exists for ``thread_id``."""
    stream = _registry.get(thread_id)
    return stream is not None and not stream.ended


def publish_chunk(thread_id: str, chunk: str) -> None:
    """Publish one SSE chunk (already formatted as ``data: …\\n\\n``).

    Called from ``_scoped_build_stream`` as it tees chunks out to the
    live HTTP response.
    """
    _get_or_create(thread_id).publish(chunk)


async def end_run(thread_id: str) -> None:
    """Mark a run as finished. Drops the broker if no subscribers remain.

    Keeps the broker alive while late subscribers are still attached so
    replay of the final RUN_FINISHED chunk still works.
    """
    async with _registry_lock:
        stream = _registry.get(thread_id)
        if stream is None:
            return
        stream.end()
        if stream.subscriber_count() == 0:
            _registry.pop(thread_id, None)


async def _release_if_idle(stream: _ThreadStream) -> None:
    async with _registry_lock:
        if stream.ended and stream.subscriber_count() == 0:
            _registry.pop(stream.thread_id, None)


async def resume_stream(thread_id: str) -> AsyncIterator[str]:
    """Yield replay + live chunks for ``thread_id``.

    If the run is already ended, replays buffered chunks and returns —
    the caller gets a complete record of the finished run. If still
    live, keeps yielding until the broker calls ``end_run``.
    """
    stream = _registry.get(thread_id)
    if stream is None:
        # Nothing to resume. Yielding a comment so the EventSource on
        # the client gets a clean open-then-close rather than a raw 404.
        yield ": no-active-run\n\n"
        return

    queue, replay, ended = stream.subscribe()
    try:
        yield ": connected\n\n"
        for chunk in replay:
            yield chunk
        if ended:
            return
        while True:
            item = await queue.get()
            if item is None:
                return
            yield item
    finally:
        stream.unsubscribe(queue)
        await _release_if_idle(stream)
