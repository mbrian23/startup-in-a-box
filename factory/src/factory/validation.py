"""BuildPlan payload validation (wire contract with the orchestrator)."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class BuildStep(BaseModel):
    id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    description: str = Field(min_length=1)
    tool_hints: list[str] = Field(default_factory=list)
    outputs: list[str] = Field(default_factory=list)
    depends_on: list[str] = Field(default_factory=list)


class BuildPlan(BaseModel):
    thought_bubble: str = "Building the project..."
    summary: str = Field(min_length=1)
    steps: list[BuildStep] = Field(min_length=1)
    tech_stack: str = "nextjs"
    brand: dict[str, Any] | None = None
    # Yara's 9-block Lean Canvas, forwarded verbatim from the
    # orchestrator. The factory quotes it as ground truth in the
    # Claude prompt so every hero headline, pricing line, and
    # mock-feature label tracks what's sealed on the parchment.
    lean_canvas: dict[str, Any] | None = None
    # Marcus's market analysis ({thought_bubble, analysis}) — informs
    # positioning in the prompt and re-emits to the UI so the Market
    # Analysis tab stays populated through the factory phase.
    market_analysis: dict[str, Any] | None = None


def validate_build_plan(forwarded_props: dict[str, Any] | None) -> BuildPlan:
    if not forwarded_props or "build_plan" not in forwarded_props:
        raise ValueError("forwarded_props.build_plan is required")
    return BuildPlan.model_validate(forwarded_props["build_plan"])
