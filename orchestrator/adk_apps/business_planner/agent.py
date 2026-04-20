"""ADK-web discovery shim for the Business Planner agent."""

from __future__ import annotations

from orchestrator.agents.business_planner import build_business_planner
from orchestrator.settings import Settings

root_agent = build_business_planner(model=Settings().orchestrator_model)
