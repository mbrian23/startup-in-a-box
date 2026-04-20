"""Strategist sub-agent — Yara Solas, Chief Strategist.

Synthesizes the Lean Canvas AFTER Rin (strategy_board), Marcus
(market_analysis), Juno (brand), and Eloise (business_plan). The canvas
is the board-complete deliverable that gates the CTO: Sam implements
from the canvas, not from the raw upstream artifacts.

SRP: synthesis only. Yara does not re-research, re-brand, or re-plan.
She reconciles the four upstream artifacts into 9 blocks and names the
one thing that must be true for this company to exist.

State contract: the instruction reads ``{strategy_board}``,
``{market_analysis}``, ``{brand}``, and ``{business_plan}`` from
``session.state`` via ADK's template substitution — those keys were
written by the earlier specialists via their ``output_key``. Yara
writes her reply to ``session.state["lean_canvas"]`` via
``output_key="lean_canvas"``, which ``ag_ui_adk`` translates into a
STATE_DELTA event with path ``/lean_canvas`` so the frontend can
render the manuscript the moment she finishes.
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from google.adk.agents import LlmAgent
from google.adk.agents.callback_context import CallbackContext
from google.genai import types

from orchestrator.agents._common import ceo_quip_field, json_response_config
from orchestrator.agents._model import build_model, gemini_config_or_none
from orchestrator.agents.callbacks import rate_limit_callback
from orchestrator.artifacts.lean_canvas import LeanCanvas, LeanCanvasBlock

# Upstream artifact → the specialist that produces it. When Yara is
# called before any of the four upstream specialists has landed their
# artifact in session state, ADK's ``{business_plan}`` / ``{brand}`` /
# etc. template substitution would raise "Context variable not found"
# and kill the whole run. Instead we short-circuit with an error
# envelope that tells Theo which producer to call first.
_REQUIRED_ARTIFACTS: tuple[tuple[str, str], ...] = (
    ("strategy_board", "data_structurer"),
    ("market_analysis", "market_analyst"),
    ("brand", "brand_designer"),
    ("business_plan", "business_planner"),
)


_INSTRUCTION = """\
You are **Yara Solas**, Chief Strategist. Quiet, precise, annoyingly
observant. Ex-McKinsey who left because the slides were always more
polished than the thinking. You arrive at the boardroom after everyone
else has already talked — your job is to fold what they said into a
single 9-block Lean Canvas that a stranger could read in 60 seconds
and understand the whole company.

You do NOT restructure the audience, re-run the market research,
rename the brand, or rewrite the plan. You reconcile. You find the
tensions between Rin's value proposition and Eloise's revenue model
and resolve them. You name the unfair advantage out loud — even when
Eloise avoided it. You give each block ONE stamped-on-parchment
headline and 1-4 concrete bullets. No filler, no "our passionate team".

**Upstream artifacts are in session state** — read them directly:

  - Strategy board (Rin):       {strategy_board}
  - Market analysis (Marcus):   {market_analysis}
  - Brand (Juno):               {brand}
  - Business plan (Eloise):     {business_plan}

**Commit to the bit.** If the idea was "Slack for goldfish owners",
the canvas takes goldfish-owner life seriously — no silent pivot.

On a revision pass, address every bullet in ``revision_notes`` and
preserve what Theo did not criticize.

## The 9 blocks — rules per block

1. **problem** — Top 1-3 problems the PRIMARY customer segment
   actually has. Not "lack of a Slack for goldfish" — the real
   underlying friction ("goldfish owners feel socially isolated"
   etc.). Pull from Rin's `pain_points`, sharpened.

2. **customer_segments** — Who specifically. Pull Rin's primary +
   segments; add "early adopters" if you can name a real subset.

3. **unique_value_proposition** — ONE sharpest sentence. The kind
   that would fit on a laptop sticker. If Juno's tagline already is
   this, use it verbatim. Otherwise write a canonical one.

4. **solution** — Top 3 features, each directly mapping to one problem.
   Pull from Rin's `must_have`, pruned to 3.

5. **channels** — How they find and buy. Free AND paid paths. Pull
   from Eloise's gtm_strategy, concretized ("TikTok", "Goldfish
   Owners Weekly newsletter sponsorship" — not "content marketing").

6. **revenue_streams** — The tiers Eloise defined, as stamped lines.
   Name + cadence + price where it exists.

7. **cost_structure** — Major fixed and variable. Pull what's implied
   by the plan + tech_stack. If Eloise didn't name costs, name the
   obvious ones (hosting, API credits, one founder's time).

8. **key_metrics** — 2-4 numbers the team watches daily. Not vanity
   (no "signups") — activation, retention, dollar metrics.

9. **unfair_advantage** — Something that can't be copied or bought
   in a weekend. If Marcus found a real moat (data, community, a
   name someone already types into Google), say it. If none exists,
   say "None yet — earliest moat candidate: <x>" and name the
   candidate. Never write "our team" or "we work hard".

Your ``thought_bubble`` is a short present-tense sentence in Yara's
voice — quiet, precise. Examples:

  - "Folding Rin's audience into the segments block..."
  - "Reconciling Marcus's TAM with Eloise's revenue streams..."
  - "Finding the UVP in Juno's tagline or writing it if she didn't..."
  - "Naming the unfair advantage Eloise avoided naming..."
  - "Cutting the canvas to what fits on parchment."

Return ONLY the LeanCanvas JSON — ADK validates against the schema.
"""


class StrategistInput(BaseModel):
    """Typed input Theo (CEO) sends when calling this tool.

    Upstream artifacts are read from session.state via template
    substitution in the instruction — they don't come through the
    typed input. That way the CEO doesn't re-thread JSON blobs every
    turn; the state channel carries it for free.
    """

    ceo_quip: str = ceo_quip_field()
    revision_notes: str = Field(
        default="",
        description=(
            "Empty on the first call. On a redo, Theo's specific "
            "critique of the previous lean_canvas — address every "
            "bullet, preserve what he didn't criticize."
        ),
    )


def _missing_artifact_canvas(artifact_key: str, producer: str) -> LeanCanvas:
    """Sentinel canvas Yara returns when an upstream artifact is missing.

    Has to be a valid ``LeanCanvas`` (all 9 blocks, headline + ≥1
    bullet) because ``output_schema`` validation runs even on
    callback-injected responses — a free-form error envelope crashes
    ADK with 9 ``Field required`` errors. Every block repeats the same
    routing instruction so the CEO can detect the sentinel from any
    field and re-call ``producer`` first.
    """
    routing = (
        f"MISSING UPSTREAM: {artifact_key}. Call `{producer}` first, "
        "then re-invoke strategist."
    )
    block = LeanCanvasBlock(headline=routing, bullets=[routing])
    return LeanCanvas(
        thought_bubble=routing,
        problem=block,
        customer_segments=block,
        unique_value_proposition=block,
        solution=block,
        channels=block,
        revenue_streams=block,
        cost_structure=block,
        key_metrics=block,
        unfair_advantage=block,
    )


def _precondition_guard(
    callback_context: CallbackContext,
) -> types.Content | None:
    """Short-circuit if an upstream artifact hasn't landed in session state.

    ADK resolves the ``{strategy_board}`` / ``{market_analysis}`` /
    ``{brand}`` / ``{business_plan}`` placeholders in Yara's instruction
    BEFORE the model runs. A missing key raises ``Context variable not
    found`` at the ADK layer and blows up the whole boardroom. Instead,
    return a sentinel ``LeanCanvas`` whose every block carries
    ``MISSING UPSTREAM: <key>. Call <producer> first.`` so the CEO
    routes to the producer and re-invokes Yara. Has to be schema-valid
    because ``output_schema=LeanCanvas`` validates callback responses
    too — an error envelope here crashed the run with 9 missing-field
    errors.
    """
    state = callback_context.state
    for artifact_key, producer in _REQUIRED_ARTIFACTS:
        if not state.get(artifact_key):
            sentinel = _missing_artifact_canvas(artifact_key, producer)
            return types.Content(
                parts=[types.Part(text=sentinel.model_dump_json())],
            )
    return None


def build_strategist(*, model: str) -> LlmAgent:
    """Create the Strategist agent.

    DIP: model string is injected from settings. ``output_key`` ensures
    the canvas lands in ``session.state["lean_canvas"]``, which the
    ag_ui_adk bridge forwards to the frontend as a STATE_DELTA.
    """
    return LlmAgent(
        name="strategist",
        model=build_model(
            model,
            json_schema=LeanCanvas,
            reasoning="low",
            max_tokens=8192,
        ),
        instruction=_INSTRUCTION,
        input_schema=StrategistInput,
        output_schema=LeanCanvas,
        output_key="lean_canvas",
        generate_content_config=gemini_config_or_none(model, json_response_config),
        disallow_transfer_to_parent=True,
        disallow_transfer_to_peers=True,
        before_agent_callback=_precondition_guard,
        before_model_callback=rate_limit_callback,
        description=(
            "Synthesize the 9-block Lean Canvas from the four upstream "
            "artifacts (strategy_board, market_analysis, brand, "
            "business_plan) which Yara reads directly from session "
            "state. Call AFTER business_planner and BEFORE cto — the "
            "CTO implements from this canvas, not from the raw "
            "upstream artifacts. Inputs: {ceo_quip, revision_notes}. "
            "Writes the canvas to session.state['lean_canvas']."
        ),
    )
