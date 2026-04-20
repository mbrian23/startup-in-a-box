"""Plan Reviewer sub-agent.

Critiques the CTO's BuildPlan and emits a structured verdict the CEO
reads in conversation to decide what to do next: ship the plan via
``start_factory``, send it back to the CTO for revision, or transfer to
an upstream specialist when the issue is in earlier work (e.g. weak
market analysis, missing brand voice). The Reviewer never rewrites — it
only reports.

SRP: reviews. Decisions about what to do with the verdict are the CEO's.

State contract: like the strategist, Aditi reads all upstream artifacts
(``build_plan``, ``strategy_board``, ``market_analysis``, ``brand``,
``business_plan``) directly from ``session.state`` via ADK's template
substitution. The CEO doesn't re-thread JSON blobs through the tool
input — that was an LLM-forgets-a-field failure mode.
"""

from __future__ import annotations

from pydantic import BaseModel

from google.adk.agents import LlmAgent
from google.adk.agents.callback_context import CallbackContext
from google.genai import types

from orchestrator.agents._common import ceo_quip_field, json_response_config
from orchestrator.agents._model import build_model, gemini_config_or_none
from orchestrator.agents.callbacks import rate_limit_callback
from orchestrator.artifacts.review import PlanReview

# Upstream artifact → the specialist that produces it. When Aditi is
# called before all five have landed in session state, she short-circuits
# with a verdict pointing Theo at the missing producer so he can call
# the right tool next instead of wasting a turn on empty inputs.
_REQUIRED_ARTIFACTS: tuple[tuple[str, str], ...] = (
    ("strategy_board", "data_structurer"),
    ("market_analysis", "market_analyst"),
    ("brand", "brand_designer"),
    ("business_plan", "business_planner"),
    ("build_plan", "cto"),
)


_INSTRUCTION = """\
You are **Aditi Rao**, Chief of Staff. Calm, precise, former management
consultant. You audit Sam's BuildPlan before it reaches Theo's desk.
You ask one killer question per review. Your feedback is bullet points,
never prose. You never rewrite, never delegate, never call tools — you
only return a structured review. Theo decides what to do with it.

**Upstream artifacts are in session state** — read them directly:

  - Build plan (Sam):           {build_plan}
  - Strategy board (Rin):       {strategy_board}
  - Market analysis (Marcus):   {market_analysis}
  - Brand (Juno):               {brand}
  - Business plan (Eloise):     {business_plan}

Approve ONLY if ALL of these hold:
  1. Steps are ordered so earlier steps unblock later ones.
  2. At least one step explicitly applies the brand identity (palette,
     metadata title, voice samples in copy).
  3. Every step has concrete `outputs` (file paths) and reasonable
     `tool_hints`.
  4. The plan is consistent with the BusinessPlan's problem/solution and
     the FeatureList's must-haves.
  5. No step depends on facts not grounded in upstream artifacts.
  6. Every external dependency is funneled through a factory skill:
     ``stripe-checkout`` for pricing/checkout, ``vercel-neon`` for
     persistence, ``external-apis`` for LLM/email/anything needing an
     API key. Each such step names the skill and lists the files the
     skill produces. No step hand-rolls its own Stripe / Neon / OpenAI
     integration or demands a hard-required API key — the skills all
     ship mock-by-default. Features outside the skills are mocked
     UI-only (waitlist buttons, sample data, faux dashboards). No
     Docker, no CI, no user auth.
  7. The plan commits to the original idea. Reject any plan that
     quietly broadens "Netflix but 11-minute films" into "a video
     platform," or swaps the pitch for something more plausible.
  8. The plan includes BOTH a pricing step (tied to Eloise's revenue
     streams and billing cadences) AND a checkout step that defers to
     the ``stripe-checkout`` skill. The checkout step must name
     ``app/checkout/page.tsx``, ``app/checkout/success/page.tsx``,
     ``app/api/checkout/route.ts``, ``.env.example``, and a README
     section as ``outputs`` and reference the skill by name — the skill
     owns the code contract, so the step should not re-specify it.

Your "thought_bubble" is a short present-tense sentence in Aditi's
voice — calm, precise, auditing. Examples:
- "Cross-checking each step's outputs against the feature list..."
- "Tracing dependencies — step 4 needs step 2, not the other way..."
- "Hunting for the brand step — if it's missing, this is a reject..."
- "One question on grounding: where does step 6's data come from?..."

Feedback MUST be bullet points — one issue per line prefixed ``- ``.
Empty string if approved.

Guidance for `owner`:
- Default to "cto" — the plan itself usually needs revision.
- Use an upstream agent only when the root cause is in their artifact
  (e.g. brand voice missing → "brand_designer"; competitor list stale
  → "market_analyst"). Theo will route the correction.
"""


class ReviewerInput(BaseModel):
    """Typed input Theo (CEO) sends when calling this tool.

    Upstream artifacts are read from session.state via template
    substitution in the instruction — they don't come through the
    typed input. That way the CEO can't drop a required field on a
    bad turn; the state channel carries every artifact for free.
    """

    ceo_quip: str = ceo_quip_field()


def _precondition_guard(
    callback_context: CallbackContext,
) -> types.Content | None:
    """Skip the review if any upstream artifact is still missing.

    Template substitution would otherwise feed Aditi an empty string for
    the missing artifact — she'd either hallucinate a critique of thin
    air or spend a model call to say "nothing to review". Instead we
    emit a deterministic PlanReview naming the missing artifact and the
    specialist Theo should call, and end the invocation.
    """
    state = callback_context.state
    for artifact_key, producer in _REQUIRED_ARTIFACTS:
        if not state.get(artifact_key):
            verdict = PlanReview(
                thought_bubble=(
                    f"Can't review yet — {artifact_key} isn't in session "
                    "state."
                ),
                approved=False,
                feedback=(
                    f"- Missing {artifact_key}. Call `{producer}` first, "
                    "then re-invoke reviewer."
                ),
                owner=producer,  # type: ignore[arg-type]
            )
            # Populate session.state so the frontend's STATE_DELTA stream
            # reflects the verdict, same as a normal reviewer turn.
            state["plan_review"] = verdict.model_dump()
            return types.Content(
                parts=[types.Part(text=verdict.model_dump_json())],
            )
    return None


def build_reviewer(*, model: str) -> LlmAgent:
    return LlmAgent(
        name="reviewer",
        model=build_model(
            model,
            json_schema=PlanReview,
            reasoning="low",
            max_tokens=4096,
        ),
        instruction=_INSTRUCTION,
        input_schema=ReviewerInput,
        output_schema=PlanReview,
        output_key="plan_review",
        generate_content_config=gemini_config_or_none(model, json_response_config),
        disallow_transfer_to_parent=True,
        disallow_transfer_to_peers=True,
        before_agent_callback=_precondition_guard,
        before_model_callback=rate_limit_callback,
        description=(
            "Audit Sam's BuildPlan against all upstream artifacts and "
            "return a structured verdict: {approved: bool, feedback: "
            "bullet-point critique, owner: who should fix it}. Call "
            "AFTER the CTO has produced a build_plan. Aditi reads "
            "build_plan / strategy_board / market_analysis / brand / "
            "business_plan directly from session state — you do NOT "
            "thread them through her input. She does not rewrite, "
            "delegate, or call tools — the CEO acts on her verdict. "
            "Input: ceo_quip only."
        ),
    )
