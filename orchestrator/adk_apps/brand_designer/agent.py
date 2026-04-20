"""ADK-web discovery shim: exposes the Brand Designer as ``root_agent``.

Run from the ``orchestrator/`` directory:

    uv run adk web ./adk_apps

The ADK dev UI will list ``brand_designer`` as a selectable app.
"""

from __future__ import annotations

from orchestrator.agents.brand_designer import build_brand_designer
from orchestrator.settings import Settings

root_agent = build_brand_designer(model=Settings().orchestrator_model)
