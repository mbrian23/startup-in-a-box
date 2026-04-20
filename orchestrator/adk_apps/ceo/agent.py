"""ADK-web discovery shim for the CEO coordinator."""

from __future__ import annotations

from orchestrator.agents.ceo import build_ceo_agent
from orchestrator.settings import Settings

root_agent = build_ceo_agent(Settings())
