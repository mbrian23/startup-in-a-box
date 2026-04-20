"""CEO tool: record a revision attempt before re-calling a specialist.

Under the AgentTool model the CEO re-invokes the specialist's tool
directly with the revision notes filled into that tool's
``revision_notes`` input field — there is no transfer step. This tool's
sole job is to cap how many times a given artifact can be bounced back
(default 2) and to return the notes in its reply so the audit trail is
intact. Revision counts live in ``tool_context.state`` (session state)
— the ADK-native channel samples use for run-scoped bookkeeping.
"""

from __future__ import annotations

import logging
from typing import Annotated, Any, Literal

from google.adk.tools import FunctionTool
from google.adk.tools.tool_context import ToolContext
from pydantic import Field

logger = logging.getLogger(__name__)

MAX_REVISIONS = 2
_STATE_KEY = "_revisions"

# Pin the argument space so Gemini emits concrete enum values instead of
# guessing at free-form strings. Both enums mirror the specialist roster
# — keep them in sync with orchestrator/agents/ceo.py sub_agents list.
ArtifactKey = Literal[
    "strategy_board",
    "market_analysis",
    "brand",
    "business_plan",
    "build_plan",
]
TargetAgent = Literal[
    "data_structurer",
    "market_analyst",
    "brand_designer",
    "business_planner",
    "cto",
]


def send_back_with_notes(
    ceo_quip: Annotated[
        str,
        Field(
            description=(
                "A short present-tense line in Theo (CEO)'s voice as he "
                "sends this artifact back for revision. 1 sentence, "
                "<=100 chars. Example: 'Rin, the pain points are too "
                "soft — one more pass.' The frontend shows this as "
                "Theo's speech bubble for the duration of the call."
            ),
            min_length=1,
            max_length=200,
        ),
    ],
    artifact_key: Annotated[
        ArtifactKey,
        Field(
            description=(
                "Which failing artifact you are returning. Must be one of "
                "the stable keys: 'strategy_board' (data_structurer), "
                "'market_analysis' (market_analyst), 'brand' "
                "(brand_designer), 'business_plan' (business_planner), or "
                "'build_plan' (cto). The reviewer's verdict is not an "
                "artifact — re-call reviewer directly, do not send it back."
            ),
        ),
    ],
    target_agent: Annotated[
        TargetAgent,
        Field(
            description=(
                "The specialist whose tool you will call next. Usually the "
                "agent that produced artifact_key, unless Aditi flagged a "
                "root cause upstream (e.g. brand voice missing on the "
                "build_plan → target_agent='brand_designer')."
            ),
        ),
    ],
    notes: Annotated[
        str,
        Field(
            description=(
                "Your Theo-voice revision directive in 1–3 sentences. "
                "Start with the person's first name. Name what's wrong "
                "AND what good looks like — be surgical, not kind. "
                "Examples: "
                "\"Rin, pain points read like marketing copy. Rewrite "
                "them as specific moments where the user loses money or "
                "time.\" / "
                "\"Marcus, 'large and growing' is not a number. Give me "
                "a figure with a source URL.\" / "
                "\"Juno, 'FlowSync' is the generic SaaS name we agreed "
                "not to ship. Give me something I'd put on a sticker.\" "
                "No throat-clearing. No 'I think'. No 'maybe'."
            ),
            min_length=1,
        ),
    ],
    tool_context: ToolContext,
) -> dict[str, Any]:
    """Record a revision before you re-call a specialist's tool.

    When to call
    ------------
    A specialist's reply just failed your gatekeeper checklist AND you
    want to give them another shot. Call this FIRST, then on the next
    turn invoke the specialist's AgentTool again — passing the `notes`
    you wrote here into that tool's `revision_notes` input field.

    When NOT to call
    ----------------
    - You approved the reply: just advance to the next specialist.
    - The reviewer (Aditi) returned approved=false: re-call the `cto`
      (or owner) tool with `revision_notes` set directly; you don't need
      to wrap the reviewer's own output in a send_back.
    - You're shipping a compromise after hitting the 2-revision cap.

    Revision cap
    ------------
    Each `artifact_key` may be bounced at most 2 times. On the third
    attempt this tool returns `status="max_attempts_exceeded"` — at that
    point accept the current version, advance, and note the compromise
    in your final handoff summary. Don't spiral.

    Returns
    -------
    A dict:
    - `status`: "sent_back" (go re-call target_agent) or
      "max_attempts_exceeded" (advance, do not re-call).
    - `artifact_key`, `target_agent`, `attempt`, `cap`: bookkeeping.
    - `notes`: your directive echoed back (use it when re-calling).
    - `message`: next-step hint in plain English.
    """
    del ceo_quip  # Consumed by the frontend via TOOL_CALL_ARGS, not here.
    counts = dict(tool_context.state.get(_STATE_KEY, {}))
    attempt = counts.get(artifact_key, 0) + 1

    if attempt > MAX_REVISIONS:
        logger.info(
            "send_back refused: %s already revised %d times (cap=%d)",
            artifact_key,
            attempt - 1,
            MAX_REVISIONS,
        )
        return {
            "status": "max_attempts_exceeded",
            "artifact_key": artifact_key,
            "attempt": attempt - 1,
            "cap": MAX_REVISIONS,
            "message": (
                f"Already sent {artifact_key} back {attempt - 1} times. "
                f"Accept the current version and advance — note the "
                f"compromise in your handoff summary."
            ),
        }

    counts[artifact_key] = attempt
    tool_context.state[_STATE_KEY] = counts

    logger.info(
        "send_back: %s → %s (attempt %d/%d): %s",
        artifact_key,
        target_agent,
        attempt,
        MAX_REVISIONS,
        notes[:120],
    )
    return {
        "status": "sent_back",
        "artifact_key": artifact_key,
        "target_agent": target_agent,
        "attempt": attempt,
        "cap": MAX_REVISIONS,
        "notes": notes,
        "message": (
            f"Revision note recorded for {artifact_key} "
            f"(attempt {attempt}/{MAX_REVISIONS}). "
            f"Now call the {target_agent} tool again with "
            f"`revision_notes` set to the notes above."
        ),
    }


send_back_tool = FunctionTool(func=send_back_with_notes)
