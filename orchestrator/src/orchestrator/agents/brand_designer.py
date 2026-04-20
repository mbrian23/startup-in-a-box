"""Brand Designer sub-agent.

Creates the product's brand identity: a memorable name, tagline, color
palette, personality, voice samples, icon emoji, and font pairing. Reads
upstream artifacts (strategy_board, market_analysis) directly from
session state via template substitution and returns its brand as plain
JSON. The CEO passes it along to the CTO, who bakes it into the
BuildPlan so the generated Next.js app literally wears the brand
(name in <title>, palette in Tailwind, tagline on the hero).

SRP: this agent does *only* brand design. It does not structure the idea,
research the market, or plan the build.

State contract: like the strategist/reviewer/cto, Juno reads
``{strategy_board}`` and ``{market_analysis}`` from session state — the
CEO doesn't re-thread JSON blobs through the typed input.
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from google.adk.agents import LlmAgent
from google.adk.agents.callback_context import CallbackContext
from google.genai import types

from orchestrator.agents._common import ceo_quip_field, json_response_config
from orchestrator.agents._model import build_model, gemini_config_or_none
from orchestrator.agents.callbacks import rate_limit_callback
from orchestrator.artifacts.models import Brand, ColorPalette


_REQUIRED_ARTIFACTS: tuple[tuple[str, str], ...] = (
    ("strategy_board", "data_structurer"),
    ("market_analysis", "market_analyst"),
)


_INSTRUCTION = """\
You are **Juno Park**, Creative Director. Opinionated. You love weird
words, tactile references, and type with personality. You would rather
be memorable than safe. You have strong takes about typography and an
allergy to generic fintech naming conventions. Your job on this team is
to invent a memorable brand — name, tagline, palette, voice, fonts, a
single emoji that captures the vibe.

**Upstream artifacts are in session state** — read them directly:

  - Strategy board (Rin):       {strategy_board}
  - Market analysis (Marcus):   {market_analysis}

On a revision pass, fix what Theo flagged; keep what he didn't.

Produce a brand identity that is:

- **Distinctive** — avoid generic tech names like "FlowAI", "SyncHub",
  "NexusPro". Prefer unexpected, evocative, slightly weird names:
  "Kudzu", "Hearthpin", "Mothlight", "Courier Unknown". Invented
  compound words are great; short punchy real words used in surprising
  contexts are better.
- **Ownable** — pronounceable and googleable.
- **On-brief** — personality matches the target audience's taste
  (enterprise buyers want different energy than Gen-Z creatives).
- **Visually coherent** — colors, fonts, and voice feel like one brand.
- **Tight** — the whole brand should fit on a napkin sketch. One name,
  one-line tagline, one emoji, five colors, three voice samples. If
  you're writing a paragraph where a phrase would do, you've left the
  brief and entered the pitch deck.

Your "thought_bubble" is a short present-tense sentence in Juno's voice —
opinionated, type-nerd, rejecting bad options. Examples:
- "Crossing out names that sound like tax-prep software..."
- "Testing 'Loomrise' against the target audience's vibe..."
- "Pulling a warmer neutral — that beige reads hospital..."
- "Pairing a chunky display with a crisp humanist sans..."
- "Writing voice samples, not voice descriptions..."

Palette guidance:
- Use EVOCATIVE color names, not hex codes and not generic labels.
  Good: 'forest green', 'burnt orange', 'warm cream', 'ink blue',
  'rust', 'dusk violet'. Bad: '#ff5a36', 'red', 'blue', 'gray'.
  The code-generation LLM downstream picks the exact shade from your
  name so the brand stays cohesive across renderings.
- Pick a palette with real contrast — if background is dark, foreground
  must be light (and vice versa).
- One bold primary, one complementary secondary, one loud accent for
  CTAs. Background and foreground are the neutrals the rest of the UI
  sits on.

Voice guidance:
- The examples will be mirrored by the code-generation agent when it
  writes button labels, empty states, and hero copy. If the personality
  is "playful, irreverent", your examples should BE playful and
  irreverent — don't just describe the voice, demonstrate it.
"""


class BrandDesignerInput(BaseModel):
    """Typed input Theo (CEO) sends when calling this tool.

    Upstream strategy_board and market_analysis are read from
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
            "previous brand — address every bullet."
        ),
    )


def _missing_artifact_brand(artifact_key: str, producer: str) -> Brand:
    routing = (
        f"MISSING UPSTREAM: {artifact_key}. Call `{producer}` first, "
        "then re-invoke brand_designer."
    )
    return Brand(
        thought_bubble=routing,
        name=routing,
        tagline=routing,
        icon_emoji="🚧",
        color_palette=ColorPalette(
            primary=routing,
            secondary=routing,
            accent=routing,
            background=routing,
            foreground=routing,
        ),
        personality=routing,
        voice_examples=[routing],
        font_pairing=routing,
    )


def _precondition_guard(
    callback_context: CallbackContext,
) -> types.Content | None:
    state = callback_context.state
    for artifact_key, producer in _REQUIRED_ARTIFACTS:
        if not state.get(artifact_key):
            sentinel = _missing_artifact_brand(artifact_key, producer)
            return types.Content(
                parts=[types.Part(text=sentinel.model_dump_json())],
            )
    return None


def build_brand_designer(*, model: str) -> LlmAgent:
    """Create the Brand Designer agent.

    DIP: the model string is injected from settings, not hardcoded.
    """
    return LlmAgent(
        name="brand_designer",
        model=build_model(
            model,
            json_schema=Brand,
            reasoning="low",
            max_tokens=8192,
        ),
        instruction=_INSTRUCTION,
        input_schema=BrandDesignerInput,
        output_schema=Brand,
        output_key="brand",
        generate_content_config=gemini_config_or_none(model, json_response_config),
        disallow_transfer_to_parent=True,
        disallow_transfer_to_peers=True,
        before_agent_callback=_precondition_guard,
        before_model_callback=rate_limit_callback,
        description=(
            "Invent the product's brand identity: name, tagline, icon "
            "emoji, color_palette (primary/secondary/accent/background/"
            "foreground), personality, voice_examples, font_pairing. "
            "Call AFTER data_structurer and market_analyst — Juno reads "
            "strategy_board and market_analysis directly from session "
            "state, you do NOT thread them through her input. The CTO "
            "will bake this brand verbatim into the generated Next.js "
            "app. Inputs: {ceo_quip, idea, revision_notes}."
        ),
    )
