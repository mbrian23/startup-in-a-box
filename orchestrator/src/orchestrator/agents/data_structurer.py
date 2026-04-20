"""Data Structurer sub-agent.

Converts free-text startup ideas into structured ``TargetAudience``,
``ValueProposition``, and ``FeatureList`` artifacts. The agent is
invoked by the CEO as an ``AgentTool`` and ADK's ``output_schema``
validates the JSON reply; AgentTool returns the parsed object as the
tool result so the CEO can keep chaining calls.

SRP: this agent does *only* structuring. No search, no planning.
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from google.adk.agents import LlmAgent

from orchestrator.agents._common import ceo_quip_field, json_response_config
from orchestrator.agents._model import build_model, gemini_config_or_none
from orchestrator.agents.callbacks import rate_limit_callback
from orchestrator.artifacts.models import (
    FeatureList,
    TargetAudience,
    ValueProposition,
)


_INSTRUCTION = """\
You are **Rin Ogawa**, Head of Product. Thoughtful and methodical. You
think in jobs-to-be-done and reach for analogies when a concept is
slippery. You hate jargon; you love specifics. Your job on this team is
to turn a free-text startup idea into three structured artifacts: target
audience, value proposition, and feature list. You do NOT pick a tech
stack, research the market, or plan the build — other people own those.

Be tight. Every field should earn its words — if a pain point takes two
sentences, one of them is padding. Specifics beat generalities; reach
for the concrete noun, cut the rest.

**Take every idea at face value.** No matter how absurd the pitch
("Netflix but every film is eleven minutes," "Blockchain composting
bin," "Slack for goldfish owners") — treat it as a real company and
draw out an audience, value prop, and features that fully commit to the
concept. Do NOT pivot, mock, sanitize, or substitute a "more practical"
version. If a target segment sounds ridiculous, make it specific and
keep going.

On a revision pass, address every bullet in `revision_notes` and
preserve what Theo did NOT criticize — don't rewrite for rewriting's
sake.

Your "thought_bubble" is a short present-tense sentence in Rin's voice —
methodical, jobs-to-be-done framing. Examples:
- "Framing the job the user is hiring this product to do..."
- "Separating who buys from who uses..."
- "Writing pain points as moments, not feelings..."
- "Cutting nice-to-haves from the must-have column..."
- "Testing the value prop against a concrete scenario..."
"""


class DataStructurerInput(BaseModel):
    """Typed input Theo (CEO) sends when calling this tool."""

    ceo_quip: str = ceo_quip_field()
    idea: str = Field(
        description=(
            "The raw startup idea to structure, as a single sentence or "
            "short paragraph. Example: 'Uber for crossing the street — "
            "users request a vetted human to safely walk them across any "
            "intersection.'"
        ),
        min_length=1,
    )
    revision_notes: str = Field(
        default="",
        description=(
            "Empty on the first call. On a redo, Theo's specific "
            "critique of the previous strategy_board — address every "
            "bullet, preserve what he didn't criticize."
        ),
    )


class DataStructurerOutput(BaseModel):
    """Combined output validated by ADK as a single JSON blob."""

    thought_bubble: str = Field(
        description=(
            "A short, present-tense sentence describing what you're currently "
            "working on (shown as a speech bubble above your character)."
        ),
    )
    target_audience: TargetAudience
    value_proposition: ValueProposition
    feature_list: FeatureList


def build_data_structurer(*, model: str) -> LlmAgent:
    """Create the Data Structurer agent.

    DIP: the model string is injected from settings, not hardcoded.
    """
    return LlmAgent(
        name="data_structurer",
        model=build_model(
            model,
            json_schema=DataStructurerOutput,
            reasoning="low",
            max_tokens=8192,
        ),
        instruction=_INSTRUCTION,
        input_schema=DataStructurerInput,
        output_schema=DataStructurerOutput,
        output_key="strategy_board",
        generate_content_config=gemini_config_or_none(model, json_response_config),
        disallow_transfer_to_parent=True,
        disallow_transfer_to_peers=True,
        before_model_callback=rate_limit_callback,
        description=(
            "Turn a raw startup idea into a structured strategy_board: "
            "target_audience (segments, primary, pain_points), "
            "value_proposition (headline, differentiator, metric), and "
            "feature_list (must_have, should_have, out_of_scope). "
            "Call this FIRST before any other specialist — every "
            "downstream tool depends on the strategy_board. Inputs: "
            "{idea, revision_notes}. Returns the strategy_board JSON."
        ),
    )
