"""Shared ADK wiring for specialist agents.

Keeping the ``GenerateContentConfig`` in one place matches the
``travel-concierge`` sample's ``shared_libraries/types.py:21`` idiom:
every ``output_schema`` agent binds the same JSON-mime-type config so
Gemini emits valid JSON deterministically instead of relying on prompt
instructions.

We also bind ``HttpRetryOptions`` so the underlying google-genai client
retries on 503 with exponential backoff. Google's free-tier Gemini
capacity throws transient ``UNAVAILABLE`` responses on every model
family (Pro, Flash, Flash-Lite); without retry a single capacity blip
on any specialist kills the whole boardroom run.

We deliberately do NOT retry 429. The free tier mixes per-minute rate
limits with a per-day quota (250 req/day on pro), and the 429 body
advertises a ``retryDelay`` measured in hours when the daily bucket
runs out. Retrying 4× with 2–15s backoff just burns time while the
frontend sits on "awaiting run…" — and the per-minute 429s are rare
enough in practice that we'd rather fail fast and let
``_classify_adk_failure`` surface a clean "quota hit" message to the UI.
"""

from __future__ import annotations

from typing import Any

from pydantic import Field
from google.genai import types


def ceo_quip_field() -> Any:
    """Shared Pydantic field factory for the CEO's in-character one-liner.

    Carried on every specialist tool call and on start_factory /
    send_back. The frontend reads this from the tool-call arguments and
    shows it as the CEO's speech bubble for the duration of the call —
    so all personality stays in structured output, never hardcoded in the UI.

    Returns a fresh ``Field()`` each call — Pydantic forbids sharing a
    ``Field`` instance across multiple models.

    Defaults to ``""`` rather than being required: the quip is purely
    cosmetic (frontend speech bubble) and Gemini occasionally drops it
    on a tool call, which with a required field blows up the entire
    run at ``model_validate``. A missing quip should degrade silently,
    not abort the boardroom.
    """
    return Field(
        default="",
        description=(
            "ONE short present-tense line in Theo Vance (CEO)'s voice — "
            "sassy, sharp, dry. Third-time founder, ex-operator, mid-40s. "
            "Addresses people by first name. Uses rhetorical questions as "
            "a scalpel. Roasts the work, not the person. Closes every "
            "handoff with a specific expectation, not a vague ask. "
            "Writes: 'Rin — who's buying this, and what's it replacing?' / "
            "'Marcus, three real competitors with pricing. Categories don't count.' / "
            "'Juno, pitch me something I'd put on a laptop sticker.' / "
            "'Marcus. \\'Growing market\\' is horoscope writing.' / "
            "'Juno — \\'FlowSync\\' is a Bluetooth speaker, not a brand.' / "
            "'Sam, are we shipping or writing a dissertation?' / "
            "'Called it. Ship.' / 'Factory — go make me look smart.' "
            "Does NOT write: 'I think we should...', 'maybe consider...', "
            "'great work team', 'let's try to...', 'let's circle back'. "
            "1 sentence, <=100 chars. Never reuse the previous turn's "
            "quip verbatim — rotate the energy (delegate / roast / observe "
            "/ decide / ship) to match the moment."
        ),
        max_length=200,
    )

_retry_options = types.HttpRetryOptions(
    attempts=4,
    initial_delay=2.0,
    max_delay=15.0,
    http_status_codes=[503],
)

_http_options_with_retry = types.HttpOptions(retry_options=_retry_options)

specialist_thinking = types.ThinkingConfig(thinking_level="low")
ceo_thinking = types.ThinkingConfig(thinking_level="medium")

json_response_config = types.GenerateContentConfig(
    response_mime_type="application/json",
    max_output_tokens=12288,
    thinking_config=specialist_thinking,
    http_options=_http_options_with_retry,
)

# For agents that don't need the JSON mime type (e.g. market_analyst,
# which uses google_search and so cannot also have output_schema): just
# the retry + thinking config.
retrying_config = types.GenerateContentConfig(
    thinking_config=specialist_thinking,
    http_options=_http_options_with_retry,
)
