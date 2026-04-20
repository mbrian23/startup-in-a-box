"""Reviewer verdict artifact.

The Reviewer emits a ``PlanReview`` after critiquing the CTO's BuildPlan.
The CEO reads this to decide whether to ship via ``start_factory``, send
the plan back to the CTO, or transfer to an upstream specialist whose
artifact is the actual root cause.
"""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

# Gemini's response_schema translator rejects enum values that are the
# empty string (``properties[owner].enum[0]: cannot be empty``). Encode
# "no owner needed" as ``None`` instead so the enum only contains real
# agent names.
ReviewOwner = Literal[
    "cto",
    "data_structurer",
    "market_analyst",
    "brand_designer",
    "business_planner",
]


class PlanReview(BaseModel):
    """Reviewer's verdict on a BuildPlan."""

    thought_bubble: str = Field(
        default="Reviewing the build plan...",
        description="Short present-tense sentence shown above the reviewer.",
    )
    approved: bool
    feedback: str = Field(
        default="",
        description="Concrete, actionable critique. Empty when approved.",
    )
    owner: Optional[ReviewOwner] = Field(
        default=None,
        description=(
            "The agent the CEO should route the correction to. Null when "
            "approved; defaults to 'cto' otherwise."
        ),
    )
