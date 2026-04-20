"""ADK tool the CEO calls to hand the BuildPlan to the software factory.

Calling this tool is the terminal action of the boardroom (ADK) phase.
The validated plan is written to ``tool_context.state["build_plan"]``
(the ADK-native channel samples like marketing-agency use for
inter-phase handoff) and echoed in the return payload.
``PipelineEventStream`` reads the plan out of the final tool-result
event, so no cross-boundary session lookup is required.

The tool reads ``build_plan`` / ``brand`` / ``lean_canvas`` directly
from ``tool_context.state`` — each specialist already writes its own
reply there via ``output_key``. Earlier revisions required the CEO to
re-thread all three artifacts as structured function-call arguments,
which made the terminal turn very slow (Gemini had to regenerate three
full nested JSON objects token-by-token into the tool call). Reading
from state removes that bottleneck entirely and matches the pattern
every other boardroom agent already uses.
"""

from __future__ import annotations

import logging
from typing import Any

from google.adk.tools import FunctionTool
from google.adk.tools.tool_context import ToolContext

from orchestrator.artifacts.lean_canvas import LeanCanvas
from orchestrator.artifacts.models import Brand, BuildPlan

logger = logging.getLogger(__name__)

BUILD_PLAN_STATE_KEY = "build_plan"


def start_factory(
    ceo_quip: str,
    tool_context: ToolContext,
) -> dict[str, Any]:
    """Hand the CTO's BuildPlan + Juno's brand + Yara's canvas to the factory.

    Call this ONCE, after the reviewer has approved the plan. The tool
    reads all three artifacts from ``session.state`` — the CTO,
    brand_designer, and strategist each land their replies there via
    ``output_key``. You do NOT thread them through the call args.

    Args:
        ceo_quip: A short present-tense line in Theo (CEO)'s voice as
            he dispatches the plan, e.g. "Ship it — let's see the
            factory roar." 1 sentence, <=100 chars. The frontend shows
            this as Theo's speech bubble for the duration of the call,
            so it should feel like a fresh remark, never reused verbatim.

    Returns:
        Confirmation dict with the queued step count and the bundled
        plan payload.
    """
    del ceo_quip  # Consumed by the frontend via TOOL_CALL_ARGS, not server-side.

    state = tool_context.state
    build_plan = state.get(BUILD_PLAN_STATE_KEY)
    brand = state.get("brand")
    lean_canvas = state.get("lean_canvas")

    missing = [
        name
        for name, value in (
            ("build_plan", build_plan),
            ("brand", brand),
            ("lean_canvas", lean_canvas),
        )
        if not isinstance(value, dict)
    ]
    if missing:
        raise ValueError(
            f"start_factory: missing upstream artifacts in session state: "
            f"{', '.join(missing)}. Call the corresponding specialist first."
        )

    plan = BuildPlan.model_validate(build_plan)
    brand_obj = Brand.model_validate(brand)
    canvas_obj = LeanCanvas.model_validate(lean_canvas)

    plan_payload = plan.model_dump()
    plan_payload["brand"] = brand_obj.model_dump()
    plan_payload["lean_canvas"] = canvas_obj.model_dump()
    # Marcus writes `market_analysis` to session state via his `output_key`.
    # Pull it through here so the factory UI's Market Analysis tab fills
    # during the factory phase (otherwise it clears at handoff).
    market_analysis = state.get("market_analysis")
    if isinstance(market_analysis, dict):
        plan_payload["market_analysis"] = market_analysis
    state[BUILD_PLAN_STATE_KEY] = plan_payload
    logger.info(
        "start_factory: queued build_plan with %d steps "
        "(tech_stack=%s, brand=%s, canvas_uvp=%r, market=%s)",
        len(plan.steps),
        plan.tech_stack,
        brand_obj.name,
        canvas_obj.unique_value_proposition.headline,
        "attached" if "market_analysis" in plan_payload else "missing",
    )
    return {
        "status": "queued",
        "step_count": len(plan.steps),
        "tech_stack": plan.tech_stack,
        "brand_attached": True,
        "canvas_attached": True,
        "market_attached": "market_analysis" in plan_payload,
        "build_plan": plan_payload,
    }


start_factory_tool = FunctionTool(func=start_factory)
