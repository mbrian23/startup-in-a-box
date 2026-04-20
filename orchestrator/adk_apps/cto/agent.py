"""ADK-web discovery shim for the CTO agent."""

from __future__ import annotations

from orchestrator.agents.cto import build_cto
from orchestrator.settings import Settings

root_agent = build_cto(model=Settings().orchestrator_model)
