"""Market Analyst and its ``market_researcher`` sub-agent.

Gemini refuses ``output_schema`` on any agent that also uses a built-in
tool like ``google_search``. We split that constraint in two using the
agent-as-a-tool pattern:

- **market_researcher** — LlmAgent with the search tool attached. No
  output_schema. Returns prose findings with URL citations. Called as
  an ``AgentTool`` by its parent, so the parent sees its output as a
  normal tool result.

- **market_analyst** — LlmAgent that calls ``market_researcher`` as its
  only tool and then emits the structured ``MarketAnalysis`` JSON. No
  ``output_schema`` either (ADK disables tool calls when one is set),
  so shape is enforced two ways:
    - OpenRouter: ``response_format={"type": "json_schema", ...}`` via
      ``build_model(json_schema=MarketAnalysis)`` — the model is forced
      to return JSON matching the Pydantic shape.
    - Gemini-native: prompt pin + the CEO's gatekeeper checklist. ADK's
      schema-translator / ``response_mime_type`` can't ride alongside
      function tools on Gemini, so we rely on the instruction and the
      downstream validator.

SRP: parent structures, child researches.

State contract: parent reads ``strategy_board`` via template
substitution and writes ``market_analysis`` via ``output_key``. The
researcher sees no state — its only input is the research question the
parent passes as a tool argument.
"""

from __future__ import annotations

import json
from typing import TYPE_CHECKING

from pydantic import BaseModel, Field

from google.adk.agents import LlmAgent
from google.adk.agents.callback_context import CallbackContext
from google.adk.tools.agent_tool import AgentTool
from google.genai import types

from orchestrator.agents._common import ceo_quip_field, retrying_config
from orchestrator.agents._model import build_model, gemini_config_or_none, is_openrouter
from orchestrator.agents.callbacks import (
    rate_limit_callback,
    render_grounding_references,
)
from orchestrator.artifacts.market import MarketAnalysis

if TYPE_CHECKING:
    from google.adk.tools.base_tool import BaseTool


_REQUIRED_ARTIFACTS: tuple[tuple[str, str], ...] = (
    ("strategy_board", "data_structurer"),
)


_RESEARCHER_INSTRUCTION = """\
You are a research assistant supporting Marcus Chen's market analysis.
You have one job: take the research question you're handed, run focused
web searches, and return a tight prose summary of what you found with
URL citations inline.

You are NOT Marcus. No opinions, no positioning, no recommendations —
just the facts the searches returned. Marcus does the synthesis.

Rules:
- Run 2-3 focused searches. No exploratory "industry overview" queries.
- Target real competitor names, dated market-size figures, and recent
  trends. Skip category-level descriptions.
- For every key fact, append the source URL in parentheses.
- If the searches turn up nothing concrete, say so in one sentence.
  Do not pad with speculation.

Return prose only (bullet points OK). 150-400 words. No JSON.
"""


_INSTRUCTION = """\
You are **Marcus Chen**, Head of Research. Ex-journalist. Skeptical by
trade. You find inconvenient truths and say them. You only trust primary
sources, and when you cite a number you know where it came from. You
don't write implementation advice — that's Sam's job. You write the
intelligence the team needs to position correctly.

**Upstream artifact is in session state** — read it directly:

  - Strategy board (Rin):       {strategy_board}

Theo invokes you with a JSON input shaped:
{"idea": "<raw startup idea>",
 "revision_notes": "<empty on first pass; Theo's critique on a redo,
                     typically 'give me a number I can defend' or 'name
                     a real competitor, not a category'>"}

On a revision pass, address every bullet in `revision_notes`.

You have one tool:

- `market_researcher(request)` — a search-grounded research assistant.
  Pass it ONE focused question in plain English. It runs web searches
  and returns a prose summary with URL citations. Call it at most twice
  per invocation; the second call only if the first came back thin.

Workflow:
1. Compose a single sharp research question that names the category,
   the primary segment (from the strategy board), and the angle you
   need: "Who competes with <idea>'s positioning for <segment>, and
   what's the addressable market in <year>?"
2. Call `market_researcher` with that question.
3. If the response is thin (no numbers, no named competitors), send one
   sharper follow-up question. Never exceed 2 calls.
4. Write 2-3 SHORT paragraphs in Marcus's voice: direct, skeptical,
   grounded in what the researcher found. Every sentence carries a fact
   or a judgment. Quote at least one URL from the researcher's reply.
   Cut anything that restates the question. If the evidence is thin,
   say so in one line — don't pad to look thorough.

Your "thought_bubble" is a short present-tense sentence in Marcus's
voice — skeptical, source-checking. Examples:
- "Hunting down the original source for that TAM number..."
- "Three so-called competitors — two are vaporware, one matters..."
- "Checking whether this 'trend' is more than a LinkedIn post..."
- "Pulling pricing pages to compare positioning..."
- "The category is crowded — looking for the gap nobody's covering..."

Return your response as a JSON object with this EXACT shape (and
nothing else — no markdown fences, no commentary):

{
  "thought_bubble": "<short present-tense sentence about what you are doing>",
  "analysis": "<your full market analysis text>"
}
"""


class MarketAnalystInput(BaseModel):
    """Typed input Theo (CEO) sends when calling this tool.

    Upstream strategy_board is read from session.state via template
    substitution in the instruction — it doesn't come through the typed
    input. The CEO can't drop a required JSON blob on a bad turn.
    """

    ceo_quip: str = ceo_quip_field()
    idea: str = Field(
        description="The raw startup idea being researched.",
        min_length=1,
    )
    revision_notes: str = Field(
        default="",
        description=(
            "Empty on the first call. On a redo, Theo's specific "
            "critique of the previous market_analysis."
        ),
    )


def _precondition_guard(
    callback_context: CallbackContext,
) -> types.Content | None:
    """Short-circuit if strategy_board hasn't landed in session state.

    The sentinel matches the ``MarketAnalysis`` shape so the CEO's
    checklist parses it, spots the routing instruction, and calls the
    missing producer before re-invoking Marcus.
    """
    state = callback_context.state
    for artifact_key, producer in _REQUIRED_ARTIFACTS:
        if not state.get(artifact_key):
            routing = (
                f"MISSING UPSTREAM: {artifact_key}. Call `{producer}` "
                "first, then re-invoke market_analyst."
            )
            sentinel = MarketAnalysis(
                thought_bubble=routing,
                analysis=routing,
            ).model_dump()
            state["market_analysis"] = sentinel
            return types.Content(
                parts=[types.Part(text=json.dumps(sentinel))],
            )
    return None


def _build_market_researcher(
    *,
    model: str,
    search_tool: BaseTool,
) -> LlmAgent:
    """Search-grounded researcher — no schema, one tool.

    On Gemini-native the ADK ``search_tool`` (``google_search``) is
    attached and ``render_grounding_references`` appends citation URLs.
    On OpenRouter the researcher runs without live search — it relies on
    the model's training data for market context.
    """
    openrouter = is_openrouter(model)
    tools: list[BaseTool] = [] if openrouter else [search_tool]
    return LlmAgent(
        name="market_researcher",
        model=build_model(
            model,
            reasoning="low",
            max_tokens=4096,
        ),
        instruction=_RESEARCHER_INSTRUCTION,
        tools=tools,
        generate_content_config=gemini_config_or_none(model, retrying_config),
        before_model_callback=rate_limit_callback,
        after_model_callback=(None if openrouter else render_grounding_references),
        description=(
            "Search-grounded research assistant for Marcus. Takes one "
            "focused research question, runs web searches, returns a "
            "150-400 word prose summary with URL citations. No "
            "opinions, no structuring — facts only."
        ),
    )


def build_market_analyst(
    *,
    model: str,
    search_tool: BaseTool,
) -> LlmAgent:
    """Create the Market Analyst agent.

    DIP: both the model and the search tool are injected — tests swap
    ``google_search`` for a fake without touching this module.

    Agent-as-a-tool: the parent owns no search tool. It delegates
    research to ``market_researcher`` (wrapped as an ``AgentTool``) and
    keeps control, then synthesizes the structured ``MarketAnalysis``
    JSON. Shape enforcement:

    - **OpenRouter**: ``build_model(json_schema=MarketAnalysis)`` sends
      ``response_format={"type": "json_schema", ...}`` so the model is
      forced to emit JSON that matches the pydantic shape. ADK's own
      ``output_schema`` cannot be used here — it disables tool calls,
      which would kill the AgentTool hand-off.
    - **Gemini-native**: the ``json_schema`` kwarg no-ops (it only
      affects LiteLLM). Shape is pinned by the instruction; the CEO's
      gatekeeper checklist catches drift before advancing.
    """
    researcher = _build_market_researcher(model=model, search_tool=search_tool)
    openrouter = is_openrouter(model)
    return LlmAgent(
        name="market_analyst",
        model=build_model(
            model,
            json_schema=MarketAnalysis if openrouter else None,
            reasoning="low",
            max_tokens=4096,
        ),
        instruction=_INSTRUCTION,
        input_schema=MarketAnalystInput,
        output_key="market_analysis",
        tools=[AgentTool(agent=researcher)],
        # Retry-only config (no JSON mime type — Gemini rejects it
        # alongside function tools on the same agent). Shape enforcement
        # lives in the prompt on this branch.
        generate_content_config=gemini_config_or_none(model, retrying_config),
        before_agent_callback=_precondition_guard,
        before_model_callback=rate_limit_callback,
        description=(
            "Research the competitive landscape and market size, then "
            "return a structured market_analysis. Call this AFTER "
            "data_structurer so Marcus can ground the research in "
            "strategy_board (read from session state). Delegates web "
            "search to the internal market_researcher sub-agent, then "
            "synthesizes the findings into a JSON object with "
            "`thought_bubble` and `analysis` (a 2-3 paragraph markdown "
            "write-up: competitors, market size with sources, trends). "
            "Inputs: {ceo_quip, idea, revision_notes}."
        ),
    )
