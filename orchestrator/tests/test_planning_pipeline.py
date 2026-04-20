"""End-to-end planning pipeline test with mocked LLM.

Runs the full agent tree (root SequentialAgent -> data_structurer ->
market_analyst -> architect) against canned LLM responses. Asserts that:
  - STATE_DELTA events are emitted for strategy_board and build_plan
  - GoogleSearch TOOL_CALL_START / TOOL_CALL_END appear
  - No RUN_FINISHED is emitted (Task 6 owns that)
  - BuildPlan round-trips through Pydantic

No live Gemini calls — deterministic by design.
"""

from __future__ import annotations

import json
from typing import Any

import pytest

from google.adk.agents import LlmAgent, SequentialAgent
from google.adk.agents.callback_context import CallbackContext
from google.adk.models.llm_request import LlmRequest
from google.adk.models.llm_response import LlmResponse
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.adk.tools import FunctionTool
from google.genai import types as genai_types

from orchestrator.artifacts.models import BuildPlan
from orchestrator.settings import Settings

# These tests exercised the old SequentialAgent root pipeline (root.py).
# That module has been removed: the active orchestrator is the LLM-driven
# CEO coordinator, which uses transfer_to_agent for hand-offs. Mocking
# transfer_to_agent deterministically requires a different fixture setup
# than `before_model_callback` per sub-agent, so this whole module is
# skipped pending a CEO-targeted rewrite.
pytestmark = pytest.mark.skip(
    reason="Pipeline test needs rewrite for the CEO coordinator (open hand-offs)."
)


# ── Canned responses ────────────────────────────────────────────────────────

VALID_DATA_STRUCTURER_OUTPUT = json.dumps(
    {
        "thought_bubble": "Breaking down the core value proposition...",
        "target_audience": {
            "segments": ["pedestrians", "elderly citizens"],
            "primary": "pedestrians",
            "pain_points": ["jaywalking risk", "long signal waits"],
        },
        "value_proposition": {
            "headline": "Cross any street safely in 30 seconds",
            "differentiator": "AI-guided real-time traffic gap detection",
            "metric": "Average crossing time under 45s",
        },
        "feature_list": {
            "must_have": ["real-time crossing signals", "mobile app"],
            "should_have": ["route optimization"],
            "out_of_scope": ["autonomous vehicles"],
        },
    }
)

VALID_BRAND_OUTPUT = json.dumps(
    {
        "thought_bubble": "Landing on a name that feels both urgent and calm...",
        "name": "Crosswise",
        "tagline": "Street-smart signals, on your side of the curb.",
        "icon_emoji": "🚸",
        "color_palette": {
            "primary": "#ff5a36",
            "secondary": "#1f3a5f",
            "accent": "#ffd166",
            "background": "#0f1115",
            "foreground": "#f7f5ef",
        },
        "personality": "street-smart, warm, urgent, irreverent",
        "voice_examples": [
            "Go now. You've got this.",
            "Red light, no sweat — we'll time the next one.",
            "Crosswise says wait.",
        ],
        "font_pairing": "Space Grotesk + Inter",
    }
)

VALID_BUILD_PLAN_OUTPUT = json.dumps(
    {
        "thought_bubble": "Designing the system architecture...",
        "summary": "Build Crosswise, an MVP crossing-assist app with real-time signals.",
        "steps": [
            {
                "id": "step-01-scaffold",
                "title": "Scaffold project",
                "description": "Create Next.js project structure for Crosswise.",
                "tool_hints": ["Write", "Bash"],
                "outputs": ["package.json", "app/page.tsx"],
                "depends_on": [],
                "requires_approval": False,
            },
            {
                "id": "step-02-brand",
                "title": "Apply Crosswise brand identity",
                "description": (
                    "Wire the Crosswise palette (#ff5a36 primary / #1f3a5f secondary) "
                    "into app/globals.css and tailwind.config.ts; set <title> to "
                    "'Crosswise — Street-smart signals, on your side of the curb.'."
                ),
                "tool_hints": ["Write"],
                "outputs": ["app/globals.css", "tailwind.config.ts", "app/layout.tsx"],
                "depends_on": ["step-01-scaffold"],
                "requires_approval": False,
            },
        ],
    }
)

MARKET_ANALYST_SUMMARY = json.dumps(
    {
        "thought_bubble": "Analyzing market size and growth trends...",
        "analysis": (
            "The pedestrian safety market is growing at 12% CAGR. "
            "Key competitors include SafeWalk and CrossGuard. "
            "Opportunity exists in AI-powered real-time guidance."
        ),
    }
)


# ── Fakes ───────────────────────────────────────────────────────────────────


_search_call_count = 0


def google_search(query: str) -> dict[str, Any]:
    """Fake GoogleSearch function. Returns canned market results.

    Named ``google_search`` so the FunctionTool's name matches the real tool.
    """
    global _search_call_count
    _search_call_count += 1
    return {
        "results": [
            {
                "title": "Pedestrian Safety Market Report 2026",
                "snippet": "Market growing at 12% CAGR...",
                "url": "https://example.com/report",
            }
        ]
    }


def _make_fake_search_tool() -> FunctionTool:
    """Build a FunctionTool-based fake for GoogleSearch.

    DIP: injected into Market Analyst so no live API call is made.
    Uses FunctionTool so ADK registers it in tools_dict properly.
    """
    global _search_call_count
    _search_call_count = 0
    return FunctionTool(func=google_search)


# ── Helpers ─────────────────────────────────────────────────────────────────


def _make_settings() -> Settings:
    return Settings(
        port=0,
        cors_origins=["http://localhost:3000"],
        google_api_key="test-key",
        factory_url="http://localhost:8888/factory",
        log_jsonl=False,
        orchestrator_model="gemini-2.5-pro",
    )


def _make_text_response(text: str) -> LlmResponse:
    """Build an LlmResponse with plain text content."""
    return LlmResponse(
        content=genai_types.Content(
            role="model",
            parts=[genai_types.Part(text=text)],
        ),
        turn_complete=True,
    )


def _make_search_call_response() -> LlmResponse:
    """Build an LlmResponse that calls GoogleSearch."""
    return LlmResponse(
        content=genai_types.Content(
            role="model",
            parts=[
                genai_types.Part(
                    function_call=genai_types.FunctionCall(
                        name="google_search",
                        args={"query": "pedestrian crossing safety market 2026"},
                    )
                )
            ],
        ),
    )


class LlmMockRouter:
    """Routes mocked LLM responses based on which agent is calling.

    Tracks call counts per agent to sequence multi-turn interactions
    (e.g. market_analyst: search call then summary).
    """

    def __init__(self) -> None:
        self._call_counts: dict[str, int] = {}

    async def before_model(
        self, callback_context: CallbackContext, llm_request: LlmRequest
    ) -> LlmResponse | None:
        agent_name = callback_context._invocation_context.agent.name
        count = self._call_counts.get(agent_name, 0)
        self._call_counts[agent_name] = count + 1

        if agent_name == "data_structurer":
            return _make_text_response(VALID_DATA_STRUCTURER_OUTPUT)

        if agent_name == "market_analyst":
            if count == 0:
                return _make_search_call_response()
            return _make_text_response(MARKET_ANALYST_SUMMARY)

        if agent_name == "brand_designer":
            return _make_text_response(VALID_BRAND_OUTPUT)

        if agent_name == "architect":
            return _make_text_response(VALID_BUILD_PLAN_OUTPUT)

        return None


def _install_mock_on_tree(
    agent: LlmAgent | SequentialAgent, router: LlmMockRouter
) -> None:
    """Recursively install the mock router as before_model_callback."""
    if isinstance(agent, LlmAgent):
        agent.before_model_callback = router.before_model
    for sub in getattr(agent, "sub_agents", []):
        _install_mock_on_tree(sub, router)


def _has_tool_named(
    agent: LlmAgent | SequentialAgent, tool_name: str
) -> bool:
    """Check if any agent in the tree has a tool with the given name."""
    for tool in getattr(agent, "tools", []):
        if getattr(tool, "name", None) == tool_name:
            return True
    for sub in getattr(agent, "sub_agents", []):
        if _has_tool_named(sub, tool_name):
            return True
    return False


async def _run_pipeline(
    fake_search: FunctionTool, mock_router: LlmMockRouter
) -> list:
    """Run the full pipeline and collect all ADK events."""
    settings = _make_settings()
    root = build_root_agent(settings, search_tool=fake_search)
    _install_mock_on_tree(root, mock_router)

    session_service = InMemorySessionService()
    runner = Runner(
        agent=root,
        app_name="orchestrator",
        session_service=session_service,
    )
    session = await session_service.create_session(
        app_name="orchestrator",
        user_id="test-user",
    )

    events = []
    async for event in runner.run_async(
        user_id="test-user",
        session_id=session.id,
        new_message=genai_types.Content(
            role="user",
            parts=[genai_types.Part(text="Uber for crossing the street")],
        ),
    ):
        events.append(event)
    return events


def _collect_state_deltas(events: list) -> dict[str, Any]:
    """Merge all state_delta dicts from events into one."""
    merged: dict[str, Any] = {}
    for event in events:
        if hasattr(event, "actions") and event.actions and event.actions.state_delta:
            merged.update(event.actions.state_delta)
    return merged


# ── Tests ───────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_planning_pipeline_emits_strategy_board_state_delta() -> None:
    """Data Structurer populates strategy_board with all three artifacts."""
    events = await _run_pipeline(_make_fake_search_tool(), LlmMockRouter())
    deltas = _collect_state_deltas(events)

    assert "strategy_board" in deltas, (
        f"Expected strategy_board in state deltas, got keys: {list(deltas.keys())}"
    )
    board = deltas["strategy_board"]
    assert "target_audience" in board
    assert "value_proposition" in board
    assert "feature_list" in board
    assert board["target_audience"]["primary"] == "pedestrians"


@pytest.mark.asyncio
async def test_planning_pipeline_emits_build_plan_state_delta() -> None:
    """Architect populates build_plan in state delta."""
    events = await _run_pipeline(_make_fake_search_tool(), LlmMockRouter())
    deltas = _collect_state_deltas(events)

    assert "build_plan" in deltas, (
        f"Expected build_plan in state deltas, got keys: {list(deltas.keys())}"
    )
    plan_data = deltas["build_plan"]
    plan = BuildPlan.model_validate(plan_data)
    assert len(plan.steps) == 2
    assert plan.steps[0].id == "step-01-scaffold"


@pytest.mark.asyncio
async def test_planning_pipeline_calls_google_search() -> None:
    """Market Analyst invokes GoogleSearch (function call + response)."""
    fake_search = _make_fake_search_tool()
    events = await _run_pipeline(fake_search, LlmMockRouter())

    assert _search_call_count >= 1

    has_search_call = False
    has_search_response = False
    for event in events:
        if event.content and event.content.parts:
            for part in event.content.parts:
                if part.function_call and part.function_call.name == "google_search":
                    has_search_call = True
                if (
                    part.function_response
                    and part.function_response.name == "google_search"
                ):
                    has_search_response = True

    assert has_search_call, "Expected a google_search function call event"
    assert has_search_response, "Expected a google_search function response event"


@pytest.mark.asyncio
async def test_no_delegate_to_factory_tool() -> None:
    """Planning agents do NOT include delegate_to_factory — Task 6 owns that."""
    settings = _make_settings()
    root = build_root_agent(settings, search_tool=_make_fake_search_tool())
    assert not _has_tool_named(root, "delegate_to_factory")


@pytest.mark.asyncio
async def test_build_plan_round_trips_through_state() -> None:
    """BuildPlan stored in state delta round-trips through Pydantic."""
    events = await _run_pipeline(_make_fake_search_tool(), LlmMockRouter())
    deltas = _collect_state_deltas(events)

    plan_data = deltas["build_plan"]
    plan = BuildPlan.model_validate(plan_data)
    reserialized = json.loads(plan.model_dump_json())
    restored = BuildPlan.model_validate(reserialized)
    assert restored == plan


@pytest.mark.asyncio
async def test_agent_construction_with_settings() -> None:
    """Root agent tree is constructible from settings without live API."""
    settings = _make_settings()
    root = build_root_agent(settings, search_tool=_make_fake_search_tool())

    assert root.name == "orchestrator_root"
    assert len(root.sub_agents) == 4

    agent_names = {a.name for a in root.sub_agents}
    assert agent_names == {
        "data_structurer",
        "market_analyst",
        "brand_designer",
        "architect",
    }


@pytest.mark.asyncio
async def test_market_analyst_has_only_search_tool() -> None:
    """ISP: Market Analyst gets exactly GoogleSearch, nothing else."""
    settings = _make_settings()
    root = build_root_agent(settings, search_tool=_make_fake_search_tool())

    market_analyst = next(a for a in root.sub_agents if a.name == "market_analyst")
    assert isinstance(market_analyst, LlmAgent)
    assert len(market_analyst.tools) == 1


@pytest.mark.asyncio
async def test_root_has_no_ambient_tools() -> None:
    """ISP: Root agent has no tools — tools live on sub-agents only."""
    settings = _make_settings()
    root = build_root_agent(settings, search_tool=_make_fake_search_tool())
    assert isinstance(root, SequentialAgent)
    # SequentialAgent has no tools attribute — it's a pure orchestrator
    assert not hasattr(root, "tools") or not root.tools
