"""Planning artifact Pydantic models.

These are the wire contract between the orchestrator's planning agents (Task 5)
and the software factory (Task 7). Any change to these fields must ship with
matching fixture updates in both test suites.

Strict validation, no ``Any`` fields. Validation failures surface as
``RUN_ERROR`` rather than silently drifting schema on demo day.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class TargetAudience(BaseModel):
    """Who the startup serves."""

    segments: list[str] = Field(min_length=1)
    primary: str = Field(min_length=1)
    pain_points: list[str] = Field(min_length=1)


class ValueProposition(BaseModel):
    """Why the startup matters."""

    headline: str = Field(min_length=1)
    differentiator: str = Field(min_length=1)
    metric: str = Field(min_length=1)


class FeatureList(BaseModel):
    """What the MVP includes (and excludes)."""

    must_have: list[str] = Field(min_length=1)
    should_have: list[str] = Field(default_factory=list)
    out_of_scope: list[str] = Field(default_factory=list)


_COLOR_DESC = (
    "Natural-language color name the code-generation LLM will translate "
    "into a hex value when writing Tailwind/globals.css. Use evocative "
    "names, not generic ones: 'forest green', 'burnt orange', 'warm "
    "cream', 'ink blue'. Do NOT supply hex codes — the model downstream "
    "picks the exact shade so the brand stays cohesive across "
    "renderings."
)


class ColorPalette(BaseModel):
    """Named color palette for the generated Next.js Tailwind theme.

    Fields are color names (e.g. 'forest green'), not hex codes. The
    factory's code-generation LLM converts them into Tailwind theme
    variables and CSS custom properties when it writes
    ``app/globals.css`` and ``tailwind.config.ts``.

    Why names, not hex: Gemini's structured-output layer handles
    deeply-nested schemas badly when inner fields carry format
    constraints (regex pattern, strict enums) — the model silently
    returns zero tokens. Color names also let the code-gen LLM resolve
    a cohesive palette from the brand's personality instead of the
    brand_designer picking five hex values blindly.
    """

    primary: str = Field(description=_COLOR_DESC)
    secondary: str = Field(description=_COLOR_DESC)
    accent: str = Field(description=_COLOR_DESC)
    background: str = Field(description=_COLOR_DESC)
    foreground: str = Field(description=_COLOR_DESC)


class Brand(BaseModel):
    """Brand identity for the product.

    Emitted by the brand_designer agent, consumed by the architect and
    baked into the generated Next.js app (name in <title>, tagline on
    the hero, palette in globals.css, voice in copy).
    """

    thought_bubble: str = Field(
        default="Crafting the brand identity...",
        description=(
            "Short present-tense sentence shown as a speech bubble above "
            "the brand_designer character."
        ),
    )
    name: str = Field(min_length=1, description="Product/brand name.")
    tagline: str = Field(min_length=1, description="Single-line tagline for the hero.")
    icon_emoji: str = Field(
        min_length=1,
        max_length=8,
        description="Single emoji used as favicon/logo placeholder.",
    )
    color_palette: ColorPalette
    personality: str = Field(
        min_length=1,
        description=(
            "3-5 adjectives describing the brand voice "
            "(e.g. 'playful, confident, irreverent')."
        ),
    )
    voice_examples: list[str] = Field(
        min_length=1,
        description=(
            "2-3 sample microcopy lines ('Ship it.', 'Let's go.') that "
            "the factory LLM should mirror when writing UI copy."
        ),
    )
    font_pairing: str = Field(
        min_length=1,
        description=(
            "Google Fonts pairing, e.g. 'Space Grotesk + JetBrains Mono' "
            "or 'Playfair Display + Inter'."
        ),
    )


class BuildStep(BaseModel):
    """A single step in the build plan.

    This is the Task 5 <-> Task 7 wire contract. The factory validates
    ``forwarded_props.build_plan`` against this exact model.
    """

    id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    description: str = Field(min_length=1)
    tool_hints: list[str] = Field(default_factory=list)
    outputs: list[str] = Field(default_factory=list)
    depends_on: list[str] = Field(default_factory=list)
    requires_approval: bool = False


class BuildPlan(BaseModel):
    """The build plan emitted by the CTO.

    Scope is intentionally tight: Sam owns the technical plan only
    (summary, steps, tech_stack). The brand is Juno's artifact and
    travels alongside the plan — the CEO bundles brand + build_plan
    together when calling ``start_factory``. Forcing the CTO to
    re-emit Juno's full Brand + ColorPalette verbatim through his
    structured output was bloating the response and triggering silent
    Gemini failures on the nested schema.
    """

    thought_bubble: str = Field(
        default="Building the project...",
        description=(
            "A short, present-tense sentence describing what you're currently "
            "working on (shown as a speech bubble above your character)."
        ),
    )
    summary: str = Field(min_length=1)
    steps: list[BuildStep] = Field(min_length=1)
    tech_stack: str = Field(default="nextjs", description="Target technology stack")
