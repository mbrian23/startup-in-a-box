"""Tests for SSE event formatting and ProgressTracker URL scraping."""

from __future__ import annotations

import json
from types import SimpleNamespace

from factory.stream import (
    ProgressTracker,
    _tool_result_text,
    run_error,
    run_finished,
    run_started,
    sse,
    state_delta,
)

TID = "thread-1"
RID = "run-1"


class TestSseFormatting:
    def test_sse_event_shape(self) -> None:
        result = sse("TEST", {"type": "TEST", "value": 42})
        assert result.startswith("event: TEST\n")
        assert result.endswith("\n\n")
        data_line = result.split("\n")[1]
        assert data_line.startswith("data: ")
        payload = json.loads(data_line[len("data: "):])
        assert payload["type"] == "TEST"

    def test_run_started_fields(self) -> None:
        result = run_started(TID, RID)
        payload = json.loads(result.split("data: ")[1].strip())
        assert payload["type"] == "RUN_STARTED"
        assert payload["threadId"] == TID
        assert payload["runId"] == RID

    def test_run_finished_includes_artifacts(self) -> None:
        arts = [{"name": "index.html"}]
        result = run_finished(TID, RID, arts)
        payload = json.loads(result.split("data: ")[1].strip())
        assert payload["type"] == "RUN_FINISHED"
        assert payload["artifacts"] == arts

    def test_run_error_includes_message(self) -> None:
        result = run_error(TID, RID, "boom")
        payload = json.loads(result.split("data: ")[1].strip())
        assert payload["type"] == "RUN_ERROR"
        assert payload["message"] == "boom"

    def test_state_delta_builds_ops(self) -> None:
        result = state_delta({"active_agent": "devops"}, TID, RID)
        payload = json.loads(result.split("data: ")[1].strip())
        assert payload["type"] == "STATE_DELTA"
        assert payload["delta"] == [{"op": "add", "path": "/active_agent", "value": "devops"}]


class TestToolResultText:
    def test_none_returns_empty(self) -> None:
        assert _tool_result_text(None) == ""

    def test_string_passthrough(self) -> None:
        assert _tool_result_text("hello") == "hello"

    def test_list_of_dicts(self) -> None:
        content = [{"text": "line1"}, {"text": "line2"}]
        assert _tool_result_text(content) == "line1\nline2"

    def test_list_skips_non_text(self) -> None:
        content = [{"image": "png"}, {"text": "ok"}]
        assert _tool_result_text(content) == "ok"


class TestProgressTrackerUrlScraping:
    def _tracker(self) -> ProgressTracker:
        return ProgressTracker(TID, RID, steps_total=3)

    def _tool_result_msg(self, text: str) -> SimpleNamespace:
        block = SimpleNamespace(
            type="tool_result",
            tool_use_id="tool-99",
            content=text,
        )
        return SimpleNamespace(content=[block])

    def _text_msg(self, text: str) -> SimpleNamespace:
        block = SimpleNamespace(type="text", text=text)
        return SimpleNamespace(content=[block])

    def test_scrapes_github_marker(self) -> None:
        tracker = self._tracker()
        msg = self._text_msg("FACTORY_GITHUB_URL: https://github.com/user/repo")
        events = tracker.translate(msg)
        deltas = [json.loads(e.split("data: ")[1].strip()) for e in events]
        github_deltas = [d for d in deltas if any(op["path"] == "/github_url" for op in d["delta"])]
        assert len(github_deltas) == 1

    def test_scrapes_deploy_marker(self) -> None:
        tracker = self._tracker()
        msg = self._text_msg("FACTORY_DEPLOYMENT_URL: https://my-app.vercel.app")
        events = tracker.translate(msg)
        deltas = [json.loads(e.split("data: ")[1].strip()) for e in events]
        deploy_deltas = [d for d in deltas if any(op["path"] == "/deployment_url" for op in d["delta"])]
        assert len(deploy_deltas) == 1
        assert tracker.deployment_url == "https://my-app.vercel.app"

    def test_deduplicates_same_url(self) -> None:
        tracker = self._tracker()
        msg = self._text_msg("FACTORY_DEPLOYMENT_URL: https://my-app.vercel.app")
        tracker.translate(msg)
        events2 = tracker.translate(msg)
        deploy_deltas = [
            e for e in events2
            if "deployment_url" in e
        ]
        assert deploy_deltas == []

    def test_fallback_regex_for_github(self) -> None:
        tracker = self._tracker()
        msg = self._text_msg("Pushed to https://github.com/user/repo")
        events = tracker.translate(msg)
        deltas = [json.loads(e.split("data: ")[1].strip()) for e in events]
        github_deltas = [d for d in deltas if any(op["path"] == "/github_url" for op in d["delta"])]
        assert len(github_deltas) == 1

    def test_fallback_regex_for_vercel(self) -> None:
        tracker = self._tracker()
        msg = self._text_msg("Deployed to https://cool-thing.vercel.app")
        events = tracker.translate(msg)
        deltas = [json.loads(e.split("data: ")[1].strip()) for e in events]
        deploy_deltas = [d for d in deltas if any(op["path"] == "/deployment_url" for op in d["delta"])]
        assert len(deploy_deltas) == 1


class TestProgressTrackerSubagentHandoff:
    def test_agent_tool_use_sets_active_agent(self) -> None:
        tracker = ProgressTracker(TID, RID, steps_total=3)
        msg = SimpleNamespace(content=[
            SimpleNamespace(
                type="tool_use",
                id="tool-1",
                name="Agent",
                input={"subagent_type": "architect"},
            ),
        ])
        events = tracker.translate(msg)
        deltas = [json.loads(e.split("data: ")[1].strip()) for e in events]
        agent_deltas = [d for d in deltas if any(op["path"] == "/active_agent" for op in d["delta"])]
        assert len(agent_deltas) == 1
        assert agent_deltas[0]["delta"][0]["value"] == "architect"

    def test_step_completion_increments_progress(self) -> None:
        tracker = ProgressTracker(TID, RID, steps_total=3)
        tracker._tool_to_subagent["tool-1"] = "architect"
        msg = SimpleNamespace(content=[
            SimpleNamespace(
                type="tool_result",
                tool_use_id="tool-1",
                content="done",
            ),
        ])
        events = tracker.translate(msg)
        deltas = [json.loads(e.split("data: ")[1].strip()) for e in events]
        progress_deltas = [d for d in deltas if any(op["path"] == "/progress" for op in d["delta"])]
        assert len(progress_deltas) == 1
        assert progress_deltas[0]["delta"][0]["value"]["steps_completed"] == 1

    def test_progress_caps_at_steps_total(self) -> None:
        tracker = ProgressTracker(TID, RID, steps_total=1)
        tracker._tool_to_subagent["tool-1"] = "architect"
        tracker._steps_completed = 1
        msg = SimpleNamespace(content=[
            SimpleNamespace(type="tool_result", tool_use_id="tool-1", content="done"),
        ])
        # Extra tool_result beyond cap — should not emit progress
        tracker._tool_to_subagent["tool-2"] = "implementer"
        msg2 = SimpleNamespace(content=[
            SimpleNamespace(type="tool_result", tool_use_id="tool-2", content="done"),
        ])
        events = tracker.translate(msg) + tracker.translate(msg2)
        progress_deltas = [e for e in events if "progress" in e]
        assert len(progress_deltas) == 0
