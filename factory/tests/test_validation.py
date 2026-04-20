"""BuildPlan / BuildStep Pydantic validation tests."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from factory.validation import BuildPlan, BuildStep, validate_build_plan


def _minimal_step(**overrides) -> dict:
    return {"id": "s1", "title": "Scaffold", "description": "Create project", **overrides}


def _minimal_plan(**overrides) -> dict:
    return {"summary": "Build the app", "steps": [_minimal_step()], **overrides}


class TestBuildStep:
    def test_valid_step(self) -> None:
        step = BuildStep(**_minimal_step())
        assert step.id == "s1"
        assert step.tool_hints == []

    def test_empty_id_rejected(self) -> None:
        with pytest.raises(ValidationError):
            BuildStep(**_minimal_step(id=""))

    def test_empty_title_rejected(self) -> None:
        with pytest.raises(ValidationError):
            BuildStep(**_minimal_step(title=""))

    def test_empty_description_rejected(self) -> None:
        with pytest.raises(ValidationError):
            BuildStep(**_minimal_step(description=""))

    def test_optional_fields_default_empty(self) -> None:
        step = BuildStep(**_minimal_step())
        assert step.tool_hints == []
        assert step.outputs == []
        assert step.depends_on == []


class TestBuildPlan:
    def test_valid_plan(self) -> None:
        plan = BuildPlan(**_minimal_plan())
        assert plan.summary == "Build the app"
        assert len(plan.steps) == 1

    def test_empty_steps_rejected(self) -> None:
        with pytest.raises(ValidationError):
            BuildPlan(**_minimal_plan(steps=[]))

    def test_empty_summary_rejected(self) -> None:
        with pytest.raises(ValidationError):
            BuildPlan(**_minimal_plan(summary=""))

    def test_defaults(self) -> None:
        plan = BuildPlan(**_minimal_plan())
        assert plan.tech_stack == "nextjs"
        assert plan.brand is None
        assert plan.lean_canvas is None
        assert plan.market_analysis is None

    def test_json_round_trip(self) -> None:
        original = BuildPlan(**_minimal_plan(brand={"primary": "#ff0000"}))
        restored = BuildPlan.model_validate_json(original.model_dump_json())
        assert restored == original


class TestValidateBuildPlan:
    def test_valid_forwarded_props(self) -> None:
        plan = validate_build_plan({"build_plan": _minimal_plan()})
        assert isinstance(plan, BuildPlan)

    def test_none_raises(self) -> None:
        with pytest.raises(ValueError, match="required"):
            validate_build_plan(None)

    def test_missing_key_raises(self) -> None:
        with pytest.raises(ValueError, match="required"):
            validate_build_plan({"other": "stuff"})

    def test_empty_dict_raises(self) -> None:
        with pytest.raises(ValueError, match="required"):
            validate_build_plan({})
