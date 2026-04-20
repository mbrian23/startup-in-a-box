"""Shared ADK callbacks.

Two patterns lifted from the canonical ``adk-samples``:

- ``rate_limit_callback`` — copy of
  ``fomc-research/fomc_research/shared_libraries/callbacks.py``. Bounds
  Gemini calls per window so a revision loop cannot burn through quota.
  Wire via ``before_model_callback`` on every specialist and the CEO.

- ``render_grounding_references`` — adapted from
  ``llm-auditor/llm_auditor/sub_agents/critic/agent.py:_render_reference``.
  When an agent uses ``google_search``, Gemini returns
  ``grounding_metadata`` that carries the source URLs. This callback
  appends ``* [Title](uri)`` citations to the response so Marcus's
  "cite the URL" persona actually produces URLs downstream readers
  can audit. Wire via ``after_model_callback`` on agents that call
  ``google_search``.
"""

from __future__ import annotations

import logging
import time

from google.adk.agents.callback_context import CallbackContext
from google.adk.models import LlmRequest, LlmResponse
from google.genai import types

logger = logging.getLogger(__name__)

# Bound per-model Gemini calls to keep a revision loop (up to 2 redos
# per artifact × 6 specialists) from bursting past free-tier quota.
_RATE_LIMIT_WINDOW_SECS = 60
_RATE_LIMIT_RPM_QUOTA = 60


def rate_limit_callback(
    callback_context: CallbackContext,
    llm_request: LlmRequest,
) -> None:
    """Sliding-window rate limit before each model call.

    Tracks a per-session timestamp + counter in ``callback_context.state``.
    Once the counter exceeds ``_RATE_LIMIT_RPM_QUOTA`` inside the window,
    sleeps until the window rolls over.
    """
    del llm_request  # only here to match ADK's callback signature
    now = time.time()
    state = callback_context.state

    if "_rate_timer_start" not in state:
        state["_rate_timer_start"] = now
        state["_rate_request_count"] = 1
        return

    request_count = state["_rate_request_count"] + 1
    elapsed = now - state["_rate_timer_start"]

    if request_count > _RATE_LIMIT_RPM_QUOTA:
        delay = _RATE_LIMIT_WINDOW_SECS - elapsed + 1
        if delay > 0:
            logger.debug("rate_limit_callback: sleeping %.1fs", delay)
            time.sleep(delay)
        state["_rate_timer_start"] = time.time()
        state["_rate_request_count"] = 1
    else:
        state["_rate_request_count"] = request_count


def render_grounding_references(
    callback_context: CallbackContext,
    llm_response: LlmResponse,
) -> LlmResponse:
    """Append ``google_search`` grounding URLs to the response text.

    Gemini drops ``grounding_metadata`` alongside the generated text when
    ``google_search`` was used. Without this callback the URLs never
    reach the caller — the agent's analysis mentions sources in prose
    but the audit trail is lost.
    """
    del callback_context
    if (
        not llm_response.content
        or not llm_response.content.parts
        or not llm_response.grounding_metadata
    ):
        return llm_response

    # Cap to keep the response from bloating the parent CEO's prompt
    # downstream. Google's grounding URLs are huge (200+ chars each)
    # and ten of them across a multi-turn boardroom can push the CEO
    # past the prompt size where Flash starts silently dropping turns.
    _MAX_REFS = 4

    references: list[str] = []
    for chunk in llm_response.grounding_metadata.grounding_chunks or []:
        if len(references) >= _MAX_REFS:
            break
        title, uri = "", ""
        if chunk.retrieved_context:
            title = chunk.retrieved_context.title or ""
            uri = chunk.retrieved_context.uri or ""
        elif chunk.web:
            title = chunk.web.title or ""
            uri = chunk.web.uri or ""
        if not (title and uri):
            continue
        # Strip the redirect-wrapper prefix Google adds; keep only the
        # destination origin so the CEO's prompt doesn't carry kilobytes
        # of vertexaisearch.cloud.google.com tokens per source.
        host = uri.split("//", 1)[-1].split("/", 1)[0]
        references.append(f"* {title} ({host})\n")

    if not references:
        return llm_response

    reference_text = "".join(["\n\nSources:\n\n", *references])
    llm_response.content.parts.append(types.Part(text=reference_text))

    # Collapse all text parts into a single part so downstream encoders
    # emit one contiguous message instead of a fragmented stream.
    if all(part.text is not None for part in llm_response.content.parts):
        merged = "\n".join(part.text for part in llm_response.content.parts)
        llm_response.content.parts[0].text = merged
        del llm_response.content.parts[1:]

    return llm_response
