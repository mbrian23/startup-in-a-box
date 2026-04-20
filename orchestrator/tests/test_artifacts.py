"""Pydantic validation fixtures for planning artifacts.

Tests both happy-path construction and known-bad inputs. BuildPlan round-trip
through JSON serialization is an explicit acceptance criterion.
"""

from __future__ import annotations

import json

import pytest
from pydantic import ValidationError

from orchestrator.artifacts.lean_canvas import LeanCanvas, LeanCanvasBlock
from orchestrator.artifacts.models import (
    BuildPlan,
    BuildStep,
    FeatureList,
    TargetAudience,
    ValueProposition,
)


# ── TargetAudience ──────────────────────────────────────────────────────────


class TestTargetAudience:
    def test_valid_target_audience(self) -> None:
        ta = TargetAudience(
            segments=["commuters", "tourists"],
            primary="commuters",
            pain_points=["jaywalking risk", "long wait times"],
        )
        assert ta.primary == "commuters"
        assert len(ta.segments) == 2

    def test_empty_segments_rejected(self) -> None:
        with pytest.raises(ValidationError):
            TargetAudience(segments=[], primary="x", pain_points=["y"])

    def test_empty_primary_rejected(self) -> None:
        with pytest.raises(ValidationError):
            TargetAudience(segments=["a"], primary="", pain_points=["y"])

    def test_empty_pain_points_rejected(self) -> None:
        with pytest.raises(ValidationError):
            TargetAudience(segments=["a"], primary="x", pain_points=[])


# ── ValueProposition ────────────────────────────────────────────────────────


class TestValueProposition:
    def test_valid_value_proposition(self) -> None:
        vp = ValueProposition(
            headline="Cross any street safely in 30 seconds",
            differentiator="AI-guided real-time traffic gap detection",
            metric="Average crossing time under 45 seconds",
        )
        assert "safely" in vp.headline

    def test_empty_headline_rejected(self) -> None:
        with pytest.raises(ValidationError):
            ValueProposition(headline="", differentiator="x", metric="y")

    def test_empty_differentiator_rejected(self) -> None:
        with pytest.raises(ValidationError):
            ValueProposition(headline="x", differentiator="", metric="y")

    def test_empty_metric_rejected(self) -> None:
        with pytest.raises(ValidationError):
            ValueProposition(headline="x", differentiator="y", metric="")


# ── FeatureList ─────────────────────────────────────────────────────────────


class TestFeatureList:
    def test_valid_feature_list(self) -> None:
        fl = FeatureList(
            must_have=["real-time crossing signals"],
            should_have=["route optimization"],
            out_of_scope=["autonomous vehicles"],
        )
        assert len(fl.must_have) == 1

    def test_empty_must_have_rejected(self) -> None:
        with pytest.raises(ValidationError):
            FeatureList(must_have=[], should_have=[], out_of_scope=[])

    def test_should_have_defaults_to_empty(self) -> None:
        fl = FeatureList(must_have=["x"])
        assert fl.should_have == []
        assert fl.out_of_scope == []


# ── BuildStep ───────────────────────────────────────────────────────────────


class TestBuildStep:
    def test_valid_build_step(self) -> None:
        step = BuildStep(
            id="step-01-scaffold",
            title="Scaffold the project",
            description="Create the initial project structure with FastAPI.",
            tool_hints=["Write", "Bash"],
            outputs=["pyproject.toml", "src/main.py"],
        )
        assert step.id == "step-01-scaffold"
        assert step.requires_approval is False

    def test_empty_id_rejected(self) -> None:
        with pytest.raises(ValidationError):
            BuildStep(id="", title="x", description="y")

    def test_depends_on_defaults_to_empty(self) -> None:
        step = BuildStep(id="s1", title="t", description="d")
        assert step.depends_on == []

    def test_requires_approval_flag(self) -> None:
        step = BuildStep(
            id="s1", title="Deploy", description="d", requires_approval=True
        )
        assert step.requires_approval is True


# ── BuildPlan ───────────────────────────────────────────────────────────────


class TestBuildPlan:
    def _make_plan(self) -> BuildPlan:
        return BuildPlan(
            thought_bubble="Designing the system architecture...",
            summary="Build an MVP crossing-assist app.",
            steps=[
                BuildStep(
                    id="step-01-scaffold",
                    title="Scaffold",
                    description="Create project structure.",
                    tool_hints=["Write"],
                    outputs=["pyproject.toml"],
                ),
                BuildStep(
                    id="step-02-api",
                    title="API routes",
                    description="Implement the core API.",
                    tool_hints=["Write", "Bash"],
                    outputs=["src/routes.py"],
                    depends_on=["step-01-scaffold"],
                ),
            ],
        )

    def test_valid_build_plan(self) -> None:
        plan = self._make_plan()
        assert len(plan.steps) == 2
        assert plan.steps[1].depends_on == ["step-01-scaffold"]

    def test_empty_steps_rejected(self) -> None:
        with pytest.raises(ValidationError):
            BuildPlan(thought_bubble="Planning...", summary="No steps", steps=[])

    def test_empty_summary_rejected(self) -> None:
        with pytest.raises(ValidationError):
            BuildPlan(
                thought_bubble="Planning...",
                summary="",
                steps=[BuildStep(id="s1", title="t", description="d")],
            )

    def test_json_round_trip(self) -> None:
        """Acceptance criterion: BuildPlan round-trips through JSON without loss."""
        original = self._make_plan()
        serialized = original.model_dump_json()
        deserialized = BuildPlan.model_validate_json(serialized)
        assert deserialized == original

    def test_dict_round_trip(self) -> None:
        """BuildPlan round-trips through dict (state delta path)."""
        original = self._make_plan()
        as_dict = json.loads(original.model_dump_json())
        restored = BuildPlan.model_validate(as_dict)
        assert restored == original


# ── LeanCanvas ──────────────────────────────────────────────────────────────


class TestLeanCanvas:
    def _make_block(self, headline: str = "A stamped line") -> LeanCanvasBlock:
        return LeanCanvasBlock(headline=headline, bullets=["one", "two"])

    def _make_canvas(self) -> LeanCanvas:
        b = self._make_block
        return LeanCanvas(
            thought_bubble="Illuminating the canvas...",
            problem=b("Commuters jaywalk"),
            customer_segments=b("Pedestrian commuters"),
            unique_value_proposition=b("A hand to hold across traffic"),
            solution=b("Request-a-human crossings"),
            channels=b("TikTok, NYT crosswalk op-eds"),
            revenue_streams=b("$2/crossing; $15/mo unlimited"),
            cost_structure=b("Vetted walker network"),
            key_metrics=b("Weekly crossings per user"),
            unfair_advantage=b("Exclusive crossing guard data"),
        )

    def test_valid_lean_canvas(self) -> None:
        canvas = self._make_canvas()
        assert canvas.unique_value_proposition.headline.startswith("A hand")
        assert len(canvas.problem.bullets) == 2

    def test_empty_bullets_rejected(self) -> None:
        with pytest.raises(ValidationError):
            LeanCanvasBlock(headline="h", bullets=[])

    def test_too_many_bullets_rejected(self) -> None:
        with pytest.raises(ValidationError):
            LeanCanvasBlock(headline="h", bullets=["a", "b", "c", "d", "e"])

    def test_empty_headline_rejected(self) -> None:
        with pytest.raises(ValidationError):
            LeanCanvasBlock(headline="", bullets=["x"])

    def test_json_round_trip(self) -> None:
        """Canvas round-trips through JSON — start_factory payload path."""
        original = self._make_canvas()
        serialized = original.model_dump_json()
        deserialized = LeanCanvas.model_validate_json(serialized)
        assert deserialized == original

    def test_dict_round_trip(self) -> None:
        """Canvas round-trips through dict — STATE_DELTA/state payload path."""
        original = self._make_canvas()
        as_dict = json.loads(original.model_dump_json())
        restored = LeanCanvas.model_validate(as_dict)
        assert restored == original


# ── CEO wires the strategist as a tool ──────────────────────────────────────


class TestCeoWiresStrategist:
    def test_strategist_is_an_agent_tool_on_the_ceo(self) -> None:
        """The CEO must have strategist as an AgentTool between
        business_planner and cto so the canvas is produced before Sam
        implements. Guards against accidental re-ordering."""
        from orchestrator.agents.ceo import build_ceo_agent
        from orchestrator.settings import Settings

        ceo = build_ceo_agent(Settings())
        # Specialist AgentTools appear first (in order), then control tools.
        specialist_names = [
            t.agent.name for t in ceo.tools if hasattr(t, "agent")
        ]
        assert "strategist" in specialist_names, (
            f"strategist missing from CEO specialists: {specialist_names}"
        )
        assert (
            specialist_names.index("business_planner")
            < specialist_names.index("strategist")
            < specialist_names.index("cto")
        ), (
            f"strategist must run between business_planner and cto: "
            f"{specialist_names}"
        )
