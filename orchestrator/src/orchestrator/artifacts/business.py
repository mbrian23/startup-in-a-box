"""Business-layer artifact models."""

from __future__ import annotations

from pydantic import BaseModel, Field


class Competitor(BaseModel):
    name: str = Field(min_length=1)
    angle: str = Field(min_length=1, description="How they attack the problem")


class RevenueStream(BaseModel):
    name: str = Field(min_length=1)
    model: str = Field(min_length=1, description="e.g. subscription, usage, one-time")
    notes: str = Field(default="")


class Milestone(BaseModel):
    horizon: str = Field(min_length=1, description="e.g. 30d, 90d, 12mo")
    goal: str = Field(min_length=1)


class BusinessPlan(BaseModel):
    thought_bubble: str = Field(default="Drafting the business plan...")
    mission: str = Field(min_length=1)
    problem: str = Field(min_length=1)
    solution: str = Field(min_length=1)
    target_market: str = Field(min_length=1)
    competitors: list[Competitor] = Field(min_length=1)
    revenue_streams: list[RevenueStream] = Field(min_length=1)
    gtm_strategy: str = Field(min_length=1, description="Go-to-market summary")
    milestones: list[Milestone] = Field(min_length=1)
