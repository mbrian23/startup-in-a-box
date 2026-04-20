"""Model routing helpers.

Every specialist and the CEO take a model name as a string
(``settings.orchestrator_model`` etc.). Two backends are supported:

- **Gemini-native** (``gemini-*``): ADK routes through google-genai
  using ``GOOGLE_API_KEY``. Knobs in ``_common`` — retry options,
  ``ThinkingConfig``, ``response_mime_type`` — only apply here.
- **OpenRouter** (``openrouter/<provider>/<model>``): wrapped in
  ``LiteLlm`` so ADK routes through LiteLLM's OpenAI-compatible
  transport. ``LiteLlm`` reads ``OPENROUTER_API_KEY`` from the
  environment automatically.

Gemini-native features that don't survive the OpenRouter hop:
``ThinkingConfig``, ``google_search``, ``response_mime_type``,
``HttpRetryOptions``, ``FunctionCallingConfig``. Equivalent behaviour
is wired through OpenAI-compat parameters:

- **JSON output** (for ``output_schema`` specialists) → request body
  ``response_format={"type": "json_object"}`` so the completion is
  guaranteed to parse as JSON before ADK's Pydantic validation runs.
- **Reasoning effort** (CEO/specialists) → request body
  ``reasoning={"effort": ...}``. OpenRouter maps this onto whatever
  the provider calls it (Gemini thinkingLevel, OpenAI reasoning_effort,
  Anthropic extended thinking budget, etc.).

Model names alone determine routing, so flipping between transports is
an env-var swap: ``ORCHESTRATOR_MODEL=gemini-3-flash-preview`` stays on
the google-genai path, ``ORCHESTRATOR_MODEL=openrouter/google/gemini-2.5-flash``
goes through OpenRouter. No code changes required.
"""

from __future__ import annotations

from typing import Any, Type, Union

from google.adk.models.lite_llm import LiteLlm
from google.genai import types
from pydantic import BaseModel


ModelLike = Union[str, LiteLlm]

# ``reasoning.effort`` values accepted by OpenRouter. Maps across providers
# (e.g. "low" → Gemini thinkingLevel "low"). ``None`` disables reasoning.
ReasoningEffort = Union[str, None]  # "minimal" | "low" | "medium" | "high"


def is_openrouter(name: str) -> bool:
    return name.startswith("openrouter/")


def build_model(
    name: str,
    *,
    json_mode: bool = False,
    json_schema: Type[BaseModel] | None = None,
    reasoning: ReasoningEffort = None,
    max_tokens: int | None = None,
) -> ModelLike:
    """Resolve ``name`` to a value suitable for ``LlmAgent(model=...)``.

    For Gemini-native names the raw string is returned unchanged; the
    flags silently no-op since their Gemini equivalents are already
    wired through ``generate_content_config`` in ``_common``.

    For OpenRouter names a ``LiteLlm`` is returned with the flags
    attached as completion-call kwargs.

    - ``json_schema`` (preferred for ``output_schema`` specialists):
      sends OpenRouter's ``response_format={"type": "json_schema",
      "strict": true, ...}`` so the model is forced to emit JSON that
      matches the Pydantic schema exactly. This is the critical bit —
      ADK's ``output_schema`` is a Gemini-native feature and does NOT
      cross the LiteLLM boundary, so without this the model gets no
      shape guidance and returns empty text, tripping ADK's Pydantic
      validation (seen as ``Invalid JSON: EOF while parsing``).
    - ``json_mode``: weaker fallback (``json_object``) for agents that
      want JSON but don't expose a schema.
    - ``reasoning``: OpenRouter reasoning-effort normalisation.
    - ``max_tokens``: raise the completion budget so specialists aren't
      truncated mid-JSON by the provider's small defaults.
    """
    if not is_openrouter(name):
        return name
    kwargs: dict[str, Any] = {}
    extra_body: dict[str, Any] = {}
    if json_schema is not None:
        # ``strict: false`` so Pydantic models with optional fields /
        # nested $defs still go through — OpenRouter's strict mode
        # requires ``additionalProperties: false`` and all props listed
        # in ``required``, neither of which Pydantic emits by default.
        # ADK's own Pydantic validation on the return path catches any
        # shape drift the model lets through.
        kwargs["response_format"] = {
            "type": "json_schema",
            "json_schema": {
                "name": json_schema.__name__,
                "strict": False,
                "schema": json_schema.model_json_schema(),
            },
        }
    elif json_mode:
        kwargs["response_format"] = {"type": "json_object"}
    if reasoning is not None:
        extra_body["reasoning"] = {"effort": reasoning}
    if max_tokens is not None:
        kwargs["max_tokens"] = max_tokens
    if extra_body:
        kwargs["extra_body"] = extra_body
    return LiteLlm(model=name, **kwargs)


def gemini_config_or_none(
    name: str,
    cfg: types.GenerateContentConfig | None,
) -> types.GenerateContentConfig | None:
    """Return ``cfg`` for Gemini-native, ``None`` for OpenRouter.

    ``GenerateContentConfig`` carries google-genai-only fields —
    ``ThinkingConfig``, ``response_mime_type``, ``HttpRetryOptions``,
    ``tool_config``. Passing them through LiteLLM either no-ops or
    errors depending on field, so we strip the whole config when routing
    OpenRouter and rely on the ``build_model`` flags instead.
    """
    return None if is_openrouter(name) else cfg
