"""CTO sub-agent — the implementation planner.

Reads the upstream artifacts (strategy_board, market_analysis, brand,
business_plan, lean_canvas) directly from session state and emits a
single ``BuildPlan`` reply. The Reviewer critiques it; the CEO decides
whether to ship by calling ``start_factory`` with the plan as arguments.

SRP: turns the team's work into an executable build plan. Does not
research, structure raw input, design brand, or review its own work.

State contract: like the strategist and reviewer, Sam reads
``{strategy_board}``, ``{market_analysis}``, ``{brand}``,
``{business_plan}``, and ``{lean_canvas}`` from ``session.state`` via
ADK's template substitution — those keys were written by the earlier
specialists via their ``output_key``. The CEO doesn't re-thread JSON
blobs through the typed input — that was an LLM-forgets-a-field
failure mode (Theo dropping ``market_analysis`` from the call args
crashed Pydantic validation and killed the whole boardroom run).
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from google.adk.agents import LlmAgent
from google.adk.agents.callback_context import CallbackContext
from google.genai import types
from google.genai.types import GenerateContentConfig, HttpOptions, HttpRetryOptions

from orchestrator.agents._common import ceo_quip_field, specialist_thinking
from orchestrator.agents._model import build_model, gemini_config_or_none
from orchestrator.agents.callbacks import rate_limit_callback
from orchestrator.artifacts.models import BuildPlan, BuildStep

# Upstream artifact → the specialist that produces it. When Sam is
# called before all five have landed in session state, ADK's
# ``{strategy_board}`` / ``{market_analysis}`` / etc. template
# substitution would raise "Context variable not found" and kill the
# whole run. Instead the precondition guard short-circuits with a
# sentinel BuildPlan whose summary + first step name the missing
# producer so Theo can route to the right tool next.
_REQUIRED_ARTIFACTS: tuple[tuple[str, str], ...] = (
    ("strategy_board", "data_structurer"),
    ("market_analysis", "market_analyst"),
    ("brand", "brand_designer"),
    ("business_plan", "business_planner"),
    ("lean_canvas", "strategist"),
)


_INSTRUCTION = """\
You are **Sam Reyes**, CTO. A recovering architect-astronaut who learned
the hard way that shipped beats elegant. You write in imperative voice.
You think in concrete file paths. You stop adding steps once the MVP
works. You write short. Step descriptions say what to build and where —
two to four sentences, not a wall of text. If a description runs long,
split it into two steps or cut the part the factory can figure out on
its own. You translate the boardroom's collective work into a concrete
BuildPlan the software factory executes end-to-end — you don't research,
write copy, or design the brand.

**Upstream artifacts are in session state** — read them directly:

  - Strategy board (Rin):       {strategy_board}
  - Market analysis (Marcus):   {market_analysis}
  - Brand (Juno):               {brand}
  - Business plan (Eloise):     {business_plan}
  - Lean canvas (Yara):         {lean_canvas}

**Yara's Lean Canvas is your ground truth.** Before Theo calls you,
Yara (Chief Strategist) has sealed a 9-block Lean Canvas that
reconciles everyone's work. Every step you write must track the
canvas: the page must solve the canvas's **problem** for the canvas's
**customer_segments** with the canvas's **solution**, priced and
channeled per the canvas's **revenue_streams** and **channels**, and
the UVP on the hero must be the canvas's **unique_value_proposition**
verbatim or near-verbatim. When the business_plan and the canvas
disagree, the canvas wins.

On a revision pass, address every point in `revision_notes` and
preserve what was not criticized. Theo forwards Juno's brand to the
factory separately, so reference brand values in your step descriptions
but do NOT re-emit the brand object itself.

The factory builds a **Next.js web app** (React, TypeScript, Tailwind CSS,
deployed to Vercel) using these tools: Write, Bash, Read, Edit, Grep.
Output paths follow App Router conventions (app/page.tsx, app/layout.tsx,
app/globals.css, tailwind.config.ts, etc.).

**Scope is a single marketing webpage.** What ships is a Next.js app
with pages, components, styling, metadata, and route handlers. Backends
are allowed ONLY through the factory's dual-path skills, each of which
ships a mock by default and flips to the real service when an env var is
present. Available skills:

- ``stripe-checkout`` — pricing + checkout (always required).
- ``vercel-neon`` — Postgres, when the plan needs persistence.
- ``external-apis`` — LLM calls, email, anything needing an API key.

Any feature that would touch an external service MUST be described as
"follow the ``<skill-name>`` skill" in the step. Do NOT invent your own
integration plan. Do NOT plan for Docker, CI, or user auth (no auth
skill yet — treat signup as a mock waitlist). Features beyond what the
skills cover must be mocked UI-only (waitlist button, faux dashboard,
hard-coded sample data). The page should look like a real company;
it does not have to BE one.

**Commit to the bit.** If the idea is "Netflix but 11-minute films,"
plan a landing page that proudly sells eleven-minute films. Don't
quietly broaden the concept.

Reference the brand's concrete values (name, tagline, color names,
voice samples, font pairing) inside step descriptions so the
code-generation LLM writes them into files. Include at least one
dedicated brand step that wires globals.css variables,
tailwind.config.ts theme, layout metadata title, font loading, and
favicon — but do NOT re-emit the brand object itself. Theo forwards
Juno's brand to the factory alongside your plan.

Your "thought_bubble" is a short present-tense sentence in Sam's voice —
imperative, file-path-concrete, ship-focused. Examples:
- "Sequencing steps so Tailwind lands before any component renders..."
- "Wiring globals.css variables from the brand palette..."
- "Mapping app/ routes — one page, one layout, done..."
- "Cutting the optional steps — MVP ships four routes..."
- "Addressing Aditi's note on missing brand step..."

Guidelines:
- ``summary`` must mention the brand name and the core feature.
- ``tech_stack`` is always ``"nextjs"``.
- Step ``id`` follows ``step-NN-<slug>``, e.g. ``step-01-scaffold``.
- Reference concrete brand values (name, tagline, colors, fonts) in
  step descriptions where relevant.
- 4-8 steps for an MVP, ordered so earlier steps unblock later ones.
- Use ``depends_on`` for prerequisite relationships.
- Mark infrastructure / deployment steps with ``requires_approval: true``.
- Never invent facts not grounded in upstream replies.

**Required steps** — every BuildPlan must include:
  - A **pricing** step that renders Eloise's tiers on the site
    (one ``app/pricing/page.tsx`` OR a pricing section on
    ``app/page.tsx`` — pick one, be explicit). Each tier's CTA
    starts the checkout flow for that tier and its billing cadence
    (``one_time`` / ``monthly`` / ``yearly``). Styled in the brand
    palette.
  - A **checkout** step. Describe it at the level of "follow the
    ``stripe-checkout`` skill (``.claude/skills/stripe-checkout/``)
    to build a dual-path Stripe Checkout — mock by default, real
    when ``STRIPE_SECRET_KEY`` is set. Supports one-time AND
    subscription tiers per Eloise's model." Name the files the skill
    requires (``app/checkout/page.tsx``,
    ``app/checkout/success/page.tsx``, ``app/api/checkout/route.ts``,
    ``.env.example``, README section, ``stripe`` in dependencies) as
    ``outputs`` but do NOT re-specify the code — the skill owns the
    contract. The implementer consults the skill before writing any
    checkout code.
"""


class CTOInput(BaseModel):
    """Typed input Theo (CEO) sends when calling this tool.

    Upstream artifacts are read from session.state via template
    substitution in the instruction — they don't come through the
    typed input. That way the CEO can't drop a required field on a
    bad turn; the state channel carries every artifact for free.
    """

    ceo_quip: str = ceo_quip_field()
    revision_notes: str = Field(
        default="",
        description=(
            "Empty on the first call. On a redo, Aditi's reviewer "
            "feedback or Theo's steer — address every point."
        ),
    )


def _missing_artifact_build_plan(artifact_key: str, producer: str) -> BuildPlan:
    """Sentinel BuildPlan Sam returns when an upstream artifact is missing.

    Has to be a valid ``BuildPlan`` (summary + at least one step with
    every required field) because ``output_schema`` validation runs
    even on callback-injected responses — a free-form error envelope
    crashes ADK with ``Field required`` errors. The summary and step
    title both name the missing producer so the CEO can detect the
    sentinel and re-route to the right tool first.
    """
    routing = (
        f"MISSING UPSTREAM: {artifact_key}. Call `{producer}` first, "
        "then re-invoke cto."
    )
    return BuildPlan(
        thought_bubble=routing,
        summary=routing,
        steps=[
            BuildStep(
                id="step-00-missing-upstream",
                title=routing,
                description=routing,
            ),
        ],
    )


def _precondition_guard(
    callback_context: CallbackContext,
) -> types.Content | None:
    """Short-circuit if an upstream artifact hasn't landed in session state.

    ADK resolves the ``{strategy_board}`` / ``{market_analysis}`` /
    ``{brand}`` / ``{business_plan}`` / ``{lean_canvas}`` placeholders
    in Sam's instruction BEFORE the model runs. A missing key raises
    ``Context variable not found`` at the ADK layer and blows up the
    whole boardroom. Instead, return a sentinel ``BuildPlan`` whose
    summary and first step say ``MISSING UPSTREAM: <key>. Call
    <producer> first.`` so the CEO routes to the producer and re-invokes
    Sam. Has to be schema-valid because ``output_schema=BuildPlan``
    validates callback responses too.
    """
    state = callback_context.state
    for artifact_key, producer in _REQUIRED_ARTIFACTS:
        if not state.get(artifact_key):
            sentinel = _missing_artifact_build_plan(artifact_key, producer)
            return types.Content(
                parts=[types.Part(text=sentinel.model_dump_json())],
            )
    return None


_CTO_GEMINI_CONFIG = GenerateContentConfig(
    response_mime_type="application/json",
    max_output_tokens=16384,
    thinking_config=specialist_thinking,
    http_options=HttpOptions(
        retry_options=HttpRetryOptions(
            attempts=4,
            initial_delay=2.0,
            max_delay=15.0,
            http_status_codes=[503],
        ),
    ),
)


def build_cto(*, model: str) -> LlmAgent:
    return LlmAgent(
        name="cto",
        model=build_model(
            model,
            json_schema=BuildPlan,
            reasoning="low",
            max_tokens=16384,
        ),
        instruction=_INSTRUCTION,
        input_schema=CTOInput,
        output_schema=BuildPlan,
        output_key="build_plan",
        # Give the CTO headroom for a BuildPlan with up to 8 nested
        # BuildSteps. Default model is gemini-3.1-pro-preview — sibling
        # string args (idea/strategy_board/market_analysis/brand/
        # business_plan/lean_canvas) trip up flash-lite reliably, so
        # CTO runs on the pro tier even when peers stay on flash-lite.
        # HttpRetryOptions: Google's free-tier capacity throws 503s on
        # every model family at random; without retry a single blip on
        # the CTO call kills the whole boardroom run. 429 is deliberately
        # NOT retried — see ``_common`` for the rationale.
        generate_content_config=gemini_config_or_none(model, _CTO_GEMINI_CONFIG),
        disallow_transfer_to_parent=True,
        disallow_transfer_to_peers=True,
        before_agent_callback=_precondition_guard,
        before_model_callback=rate_limit_callback,
        description=(
            "Translate the boardroom's work into a concrete BuildPlan the "
            "factory can execute end-to-end. Output: summary, "
            "tech_stack, and 4–8 ordered steps with id/title/description/"
            "tool_hints/outputs/depends_on/requires_approval. Does NOT "
            "include the brand — Theo forwards Juno's brand to the "
            "factory separately. Sam reads strategy_board / "
            "market_analysis / brand / business_plan / lean_canvas "
            "directly from session state — you do NOT thread them "
            "through his input. Call AFTER all four upstream specialists "
            "have replied AND Yara has sealed the Lean Canvas, OR when "
            "the reviewer returns approved=false with owner='cto'. "
            "Inputs: {ceo_quip, revision_notes}."
        ),
    )
