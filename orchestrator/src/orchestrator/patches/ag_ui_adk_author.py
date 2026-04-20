"""Populate ``TextMessageStartEvent.name`` with the ADK author.

**Pinned to ag-ui-adk==0.6.0 / ag-ui-protocol==0.1.15.**

Why this exists
---------------
The AG-UI protocol's ``TextMessageStartEvent`` has an optional ``name``
field (ag_ui/core/events.py — ``name: Optional[str] = None``) specifically
so multi-agent streams can label which agent is speaking. ADK events
already carry the agent name in ``adk_event.author`` (see
``event_translator.py:1352`` upstream: *"ADK agents set author to the
agent's name"*), but the 0.6.0 translator drops it on the floor when
constructing the START event at lines 643-647:

    start_event = TextMessageStartEvent(
        type=EventType.TEXT_MESSAGE_START,
        message_id=self._streaming_message_id,
        role="assistant",
    )  # <-- no name, no raw_event

Without this patch, the frontend has no reliable way to tell which agent
produced a given message in a coordinator-driven (non-sequential) pipeline.

What the patch does
-------------------
Wraps ``EventTranslator._translate_text_content`` so that every
``TextMessageStartEvent`` it yields carries ``name = adk_event.author``.
The original generator is left untouched for every other event type.

If the upstream lib eventually sets ``name`` itself, this patch becomes
a no-op (the ``evt.name is None`` guard prevents double-writes).
"""

from __future__ import annotations

import logging
from typing import Any, AsyncGenerator

from ag_ui.core import BaseEvent, TextMessageStartEvent
from ag_ui_adk import event_translator as _et

logger = logging.getLogger(__name__)

_EXPECTED_VERSION = "0.6.0"


def _install_patch() -> None:
    # Guard against accidental double-application (re-imports in tests).
    if getattr(_et.EventTranslator, "_agent_name_patch_applied", False):
        return

    try:
        import ag_ui_adk

        installed = getattr(ag_ui_adk, "__version__", None)
    except Exception:
        installed = None

    if installed and installed != _EXPECTED_VERSION:
        logger.warning(
            "ag_ui_adk %s installed but patch was written for %s — "
            "re-verify event_translator.py:_translate_text_content "
            "still drops adk_event.author before trusting this patch.",
            installed,
            _EXPECTED_VERSION,
        )

    original = _et.EventTranslator._translate_text_content

    async def _patched_translate_text_content(
        self: Any,
        adk_event: Any,
        thread_id: str,
        run_id: str,
    ) -> AsyncGenerator[BaseEvent, None]:
        author = getattr(adk_event, "author", None)
        async for evt in original(self, adk_event, thread_id, run_id):
            if (
                author
                and isinstance(evt, TextMessageStartEvent)
                and evt.name is None
            ):
                # TextMessageStartEvent is a pydantic model; model_copy is
                # the safe way to produce a labeled variant without mutating
                # a possibly-frozen instance.
                evt = evt.model_copy(update={"name": author})
            yield evt

    _et.EventTranslator._translate_text_content = _patched_translate_text_content
    _et.EventTranslator._agent_name_patch_applied = True
    logger.info("Applied ag_ui_adk author→name patch (pinned %s)", _EXPECTED_VERSION)


_install_patch()
