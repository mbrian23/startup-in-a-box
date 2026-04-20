"""Market analysis artifact.

Marcus (``market_analyst``) emits a ``MarketAnalysis`` after delegating
the actual web research to the ``market_researcher`` sub-agent. Splitting
search off into a child avoids Gemini's tool + ``output_schema`` conflict:
the parent stays tool-bearing (one AgentTool), the child owns the search
tool, and shape enforcement for the parent happens via
``response_format`` on OpenRouter and prompt-pinning on Gemini.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class MarketAnalysis(BaseModel):
    """Marcus's structured brief on the competitive landscape."""

    thought_bubble: str = Field(
        default="Hunting down the original source for that number...",
        description=(
            "Short present-tense sentence in Marcus's voice — shown as "
            "his speech bubble while the analysis renders."
        ),
    )
    analysis: str = Field(
        description=(
            "2-3 short paragraphs of markdown: real competitors with "
            "positioning, market-size signals quoted with sources, "
            "relevant trends. Cites URLs from the researcher's findings."
        ),
        min_length=1,
    )
