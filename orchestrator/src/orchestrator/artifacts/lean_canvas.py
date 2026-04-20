"""Lean Canvas artifact.

Ash Maurya's 9-block adaptation of the Business Model Canvas, produced
by the Strategist (Yara) after the other specialists finish. The canvas
is the "board-complete" deliverable: the CTO implements from it, the
factory's Claude prompt quotes it, and the UI renders it as an
illuminated manuscript.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class LeanCanvasBlock(BaseModel):
    """One of the nine blocks on the canvas.

    Each block carries a short stamped headline and 1-4 supporting
    bullets. The headline is what the UI etches in serif display type;
    the bullets are the bulleted illumination beneath.
    """

    headline: str = Field(
        min_length=1,
        description=(
            "A single short line (<=90 chars) that names the essence "
            "of this block. Think parchment inscription, not paragraph."
        ),
    )
    bullets: list[str] = Field(
        min_length=1,
        max_length=4,
        description="1-4 supporting bullets. Concrete, no filler.",
    )


class LeanCanvas(BaseModel):
    """Nine blocks, in Ash Maurya canonical order.

    The frontend renders this as a 5-column grid matching the canonical
    Lean Canvas layout:

        +----------+----------+----------+-------------+--------------+
        | Problem  | Solution |          | Unfair Adv  | Customer     |
        |          |----------|   UVP    |-------------|  Segments    |
        |          | Key Metr |          | Channels    |              |
        +----------+----------+----------+-------------+--------------+
        |        Cost Structure          |    Revenue Streams         |
        +--------------------------------+----------------------------+
    """

    thought_bubble: str = Field(
        default="Illuminating the canvas...",
        description=(
            "Short present-tense line in Yara's voice, shown as her "
            "speech bubble while the canvas is being composed."
        ),
    )

    problem: LeanCanvasBlock = Field(
        description="Top 1-3 problems the target customer actually has.",
    )
    customer_segments: LeanCanvasBlock = Field(
        description=(
            "Who specifically buys and uses this. Early adopters named."
        ),
    )
    unique_value_proposition: LeanCanvasBlock = Field(
        description=(
            "The one sharpest sentence that tells a stranger why this "
            "exists and why it's different."
        ),
    )
    solution: LeanCanvasBlock = Field(
        description="Top 3 features that directly address each problem.",
    )
    channels: LeanCanvasBlock = Field(
        description="How customers find and buy — free and paid paths.",
    )
    revenue_streams: LeanCanvasBlock = Field(
        description=(
            "Where the money comes from. Tiers, cadence, unit economics "
            "where meaningful."
        ),
    )
    cost_structure: LeanCanvasBlock = Field(
        description=(
            "Major fixed and variable costs — what the business actually "
            "burns to exist."
        ),
    )
    key_metrics: LeanCanvasBlock = Field(
        description=(
            "The 2-4 numbers the team would watch daily to know it's "
            "working."
        ),
    )
    unfair_advantage: LeanCanvasBlock = Field(
        description=(
            "Something that can't be bought or copied in a weekend. "
            "Name it concretely — no 'our team'."
        ),
    )
