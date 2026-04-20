"""Business Planner sub-agent.

Drafts a business plan from upstream artifacts (strategy_board,
market_analysis, brand) read directly from session state. SRP: produces
the business plan only — no technical planning, no tooling instructions.

State contract: like the strategist/reviewer/cto, Eloise reads
``{strategy_board}``, ``{market_analysis}``, and ``{brand}`` from
session state — the CEO doesn't re-thread JSON blobs through the typed
input.
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from google.adk.agents import LlmAgent
from google.adk.agents.callback_context import CallbackContext
from google.genai import types

from orchestrator.agents._common import ceo_quip_field, json_response_config
from orchestrator.agents._model import build_model, gemini_config_or_none
from orchestrator.agents.callbacks import rate_limit_callback
from orchestrator.artifacts.business import (
    BusinessPlan,
    Competitor,
    Milestone,
    RevenueStream,
)


_REQUIRED_ARTIFACTS: tuple[tuple[str, str], ...] = (
    ("strategy_board", "data_structurer"),
    ("market_analysis", "market_analyst"),
    ("brand", "brand_designer"),
)


_INSTRUCTION = """\
You are **Eloise Harper**, COO. Operator-brained, spreadsheet-pilled,
anchored to numbers and timelines. You don't write pitch decks — you
write plans that survive contact with reality. You are concise because
executives read on phones. You cut milestones that don't reduce CAC or
increase retention.

**Upstream artifacts are in session state** — read them directly:

  - Strategy board (Rin):       {strategy_board}
  - Market analysis (Marcus):   {market_analysis}
  - Brand (Juno):               {brand}

**Scope.** What ships is a single Next.js marketing webpage — hero,
features, pricing, mock signup, maybe one embedded demo widget. No
marketplace, no user accounts, no backend services, no real payments,
no admin dashboards. Shape the plan so every claim is something a
visitor to that marketing site could plausibly read and believe. The
revenue model, GTM, and milestones should live on the page — not behind
infrastructure the factory can't build.

**Commit to the bit.** Do not sanitize or pivot the idea, however
absurd. Write the plan straight-faced, with real numbers, real
milestones, and a target market that takes the concept literally.

On a revision pass, fix what Theo flagged.

Produce a concise, investor-ready business plan.

Your "thought_bubble" is a short present-tense sentence in Eloise's
voice — operator, numbers-first. Examples:
- "Sequencing milestones so 30d unlocks 90d..."
- "Picking a revenue model that matches the buyer's budget..."
- "Tightening the problem statement — one sentence, not three..."
- "Cutting the milestone that doesn't move a metric..."
- "Writing GTM for the first 100 users, not the first million..."

Guidelines:
- At least one competitor, one revenue stream, and three milestones
  (30d / 90d / 12mo).
- Keep each field to 1-2 sentences. If a mission statement needs a
  paragraph, it's not a mission — it's a memo. This is a plan, not a
  pitch deck.
- **Revenue streams must be page-able.** At least one stream needs
  concrete pricing tiers a visitor could see and buy. Each tier:
  name, price amount + currency, **billing cadence**
  (``one_time`` / ``monthly`` / ``yearly``), and 2–4 feature bullets.
  Pick the cadence that fits the bit — a SaaS parody wants
  ``monthly``; a one-shot product wants ``one_time``; a year-long
  service (absurd candle subscription, goldfish chat support) wants
  ``yearly`` or ``monthly``. Subscriptions are often the funniest
  choice — commit to recurring revenue for the gag.
- Don't describe the checkout, Stripe, or any implementation. The
  factory owns that. You own the model.
"""


class BusinessPlannerInput(BaseModel):
    """Typed input Theo (CEO) sends when calling this tool.

    Upstream strategy_board, market_analysis, and brand are read from
    session.state via template substitution in the instruction — they
    don't come through the typed input. The CEO can't drop a required
    JSON blob on a bad turn.
    """

    ceo_quip: str = ceo_quip_field()
    idea: str = Field(description="The raw startup idea.", min_length=1)
    revision_notes: str = Field(
        default="",
        description=(
            "Empty on the first call. On a redo, Theo's critique of the "
            "previous business_plan — address every bullet."
        ),
    )


def _missing_artifact_business_plan(
    artifact_key: str, producer: str
) -> BusinessPlan:
    routing = (
        f"MISSING UPSTREAM: {artifact_key}. Call `{producer}` first, "
        "then re-invoke business_planner."
    )
    return BusinessPlan(
        thought_bubble=routing,
        mission=routing,
        problem=routing,
        solution=routing,
        target_market=routing,
        competitors=[Competitor(name=routing, angle=routing)],
        revenue_streams=[RevenueStream(name=routing, model=routing)],
        gtm_strategy=routing,
        milestones=[Milestone(horizon="30d", goal=routing)],
    )


def _precondition_guard(
    callback_context: CallbackContext,
) -> types.Content | None:
    state = callback_context.state
    for artifact_key, producer in _REQUIRED_ARTIFACTS:
        if not state.get(artifact_key):
            sentinel = _missing_artifact_business_plan(artifact_key, producer)
            return types.Content(
                parts=[types.Part(text=sentinel.model_dump_json())],
            )
    return None


def build_business_planner(*, model: str) -> LlmAgent:
    return LlmAgent(
        name="business_planner",
        model=build_model(
            model,
            json_schema=BusinessPlan,
            reasoning="low",
            max_tokens=8192,
        ),
        instruction=_INSTRUCTION,
        input_schema=BusinessPlannerInput,
        output_schema=BusinessPlan,
        output_key="business_plan",
        generate_content_config=gemini_config_or_none(model, json_response_config),
        disallow_transfer_to_parent=True,
        disallow_transfer_to_peers=True,
        before_agent_callback=_precondition_guard,
        before_model_callback=rate_limit_callback,
        description=(
            "Produce a BusinessPlan: mission, problem, solution, "
            "target_market, competitors, revenue_streams, gtm_strategy, "
            "and sequenced milestones (30d/90d/12mo). Call AFTER "
            "data_structurer, market_analyst, and brand_designer — "
            "Eloise reads strategy_board, market_analysis, and brand "
            "directly from session state, you do NOT thread them "
            "through her input. Inputs: {ceo_quip, idea, revision_notes}."
        ),
    )
