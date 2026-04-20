"""Tests for runner prompt assembly and error detection."""

from __future__ import annotations

from factory.runner import (
    _detect_cli_failure,
    _detect_rate_limit,
    _format_canvas,
    _format_market,
    _prompt_for_plan,
)
from factory.validation import BuildPlan, BuildStep


def _step(**kw) -> BuildStep:
    return BuildStep(id="s1", title="Scaffold", description="Create project", **kw)


def _plan(**kw) -> BuildPlan:
    return BuildPlan(summary="Build the app", steps=[_step()], **kw)


class TestFormatCanvas:
    def test_renders_blocks(self) -> None:
        canvas = {
            "problem": {"headline": "No good tools", "bullets": ["Pain A", "Pain B"]},
            "solution": {"headline": "Our tool"},
        }
        lines = _format_canvas(canvas)
        assert lines[0].startswith("LEAN CANVAS")
        assert any("Problem: No good tools" in l for l in lines)
        assert any("- Pain A" in l for l in lines)
        assert any("Solution: Our tool" in l for l in lines)

    def test_skips_non_dict_blocks(self) -> None:
        canvas = {"problem": "just a string"}
        lines = _format_canvas(canvas)
        assert len(lines) == 2  # header + trailing blank


class TestFormatMarket:
    def test_renders_analysis(self) -> None:
        market = {"analysis": "Competitors are weak in X."}
        lines = _format_market(market)
        assert any("Competitors" in l for l in lines)

    def test_empty_analysis_returns_nothing(self) -> None:
        assert _format_market({"analysis": ""}) == []
        assert _format_market({"analysis": "   "}) == []
        assert _format_market({}) == []


class TestPromptForPlan:
    def test_full_deploy_mode(self) -> None:
        prompt = _prompt_for_plan(_plan(), can_deploy=True, can_push=True)
        assert "FACTORY_DEPLOYMENT_URL" in prompt
        assert "DEPLOY MODE" not in prompt

    def test_local_only_mode(self) -> None:
        prompt = _prompt_for_plan(_plan(), can_deploy=False, can_push=False)
        assert "DEPLOY MODE: local-only" in prompt
        assert "Skip the devops" in prompt

    def test_vercel_only_mode(self) -> None:
        prompt = _prompt_for_plan(_plan(), can_deploy=True, can_push=False)
        assert "DEPLOY MODE: Vercel-only" in prompt
        assert "skip `gh repo create`" in prompt

    def test_github_only_mode(self) -> None:
        prompt = _prompt_for_plan(_plan(), can_deploy=False, can_push=True)
        assert "DEPLOY MODE: GitHub-only" in prompt
        assert "skip all `vercel`" in prompt

    def test_includes_canvas_when_present(self) -> None:
        plan = _plan(lean_canvas={"problem": {"headline": "Test"}})
        prompt = _prompt_for_plan(plan)
        assert "LEAN CANVAS" in prompt

    def test_includes_market_when_present(self) -> None:
        plan = _plan(market_analysis={"analysis": "The market is big."})
        prompt = _prompt_for_plan(plan)
        assert "MARKET CONTEXT" in prompt

    def test_includes_brand_when_present(self) -> None:
        plan = _plan(brand={"primary": "#ff0000"})
        prompt = _prompt_for_plan(plan)
        assert "Brand context" in prompt

    def test_step_formatting(self) -> None:
        plan = _plan()
        plan.steps = [
            BuildStep(id="s1", title="Init", description="Setup", outputs=["package.json"]),
            BuildStep(id="s2", title="Build", description="Code it"),
        ]
        prompt = _prompt_for_plan(plan)
        assert "1. [s1] Init — Setup" in prompt
        assert "produces: package.json" in prompt
        assert "2. [s2] Build — Code it" in prompt


class TestDetectRateLimit:
    def test_detects_rate_limit_error(self) -> None:
        assert _detect_rate_limit(["Error: rate_limit_error"]) is not None

    def test_detects_429(self) -> None:
        assert _detect_rate_limit(["HTTP 429 Too Many Requests"]) is not None

    def test_detects_overloaded(self) -> None:
        result = _detect_rate_limit(["overloaded_error: API is overloaded"])
        assert result is not None
        assert "overloaded" in result.lower()

    def test_returns_none_for_clean_output(self) -> None:
        assert _detect_rate_limit(["Starting build...", "Done."]) is None

    def test_returns_none_for_empty(self) -> None:
        assert _detect_rate_limit([]) is None


class TestDetectCliFailure:
    def test_detects_low_credit_balance(self) -> None:
        result = _detect_cli_failure(["Error: credit balance is too low"])
        assert "Top up" in result

    def test_detects_invalid_api_key(self) -> None:
        result = _detect_cli_failure(["invalid api key provided"])
        assert "ANTHROPIC_API_KEY" in result

    def test_detects_rate_limit(self) -> None:
        result = _detect_cli_failure(["rate limit exceeded"])
        assert "rate limit" in result.lower()

    def test_surfaces_last_line_for_unknown_error(self) -> None:
        result = _detect_cli_failure(["line 1", "something unexpected happened"])
        assert "something unexpected happened" in result

    def test_empty_stderr_gives_generic_message(self) -> None:
        result = _detect_cli_failure([])
        assert "no output" in result.lower()
