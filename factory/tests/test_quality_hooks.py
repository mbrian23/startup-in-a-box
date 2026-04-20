"""Tests for pre_bash_guard deny patterns and post_write_lint rules."""

from __future__ import annotations

import pytest

from factory.quality_hooks import _lint_content, pre_bash_guard, post_write_lint


def _bash_input(command: str) -> dict:
    return {"tool_input": {"command": command}}


class TestPreBashGuard:
    @pytest.mark.parametrize("cmd", [
        "rm -rf /etc",
        "rm -rf /home/user",
        "rm -rf /",
    ])
    async def test_denies_rm_rf_absolute(self, cmd: str) -> None:
        result = await pre_bash_guard(_bash_input(cmd), None, None)
        assert result["hookSpecificOutput"]["permissionDecision"] == "deny"

    @pytest.mark.parametrize("cmd", [
        "rm -rf *",
        "rm -rf .",
        "rm -rf ~",
    ])
    async def test_denies_rm_rf_broad(self, cmd: str) -> None:
        result = await pre_bash_guard(_bash_input(cmd), None, None)
        assert result["hookSpecificOutput"]["permissionDecision"] == "deny"

    async def test_denies_force_push(self) -> None:
        result = await pre_bash_guard(_bash_input("git push origin main --force"), None, None)
        assert result["hookSpecificOutput"]["permissionDecision"] == "deny"

    async def test_denies_force_push_short_flag(self) -> None:
        result = await pre_bash_guard(_bash_input("git push -f origin main"), None, None)
        assert result["hookSpecificOutput"]["permissionDecision"] == "deny"

    async def test_denies_git_reset_hard(self) -> None:
        result = await pre_bash_guard(_bash_input("git reset --hard HEAD~3"), None, None)
        assert result["hookSpecificOutput"]["permissionDecision"] == "deny"

    async def test_denies_no_verify(self) -> None:
        result = await pre_bash_guard(_bash_input("git commit --no-verify -m 'yolo'"), None, None)
        assert result["hookSpecificOutput"]["permissionDecision"] == "deny"

    async def test_denies_sudo(self) -> None:
        result = await pre_bash_guard(_bash_input("sudo apt install something"), None, None)
        assert result["hookSpecificOutput"]["permissionDecision"] == "deny"

    async def test_denies_fork_bomb(self) -> None:
        result = await pre_bash_guard(_bash_input(":() { :|:& }; :"), None, None)
        assert result["hookSpecificOutput"]["permissionDecision"] == "deny"

    @pytest.mark.parametrize("cmd", [
        "npm install",
        "git commit -m 'good commit'",
        "rm -f single-file.txt",
        "git push origin main",
        "npx tsc --noEmit",
    ])
    async def test_allows_safe_commands(self, cmd: str) -> None:
        result = await pre_bash_guard(_bash_input(cmd), None, None)
        assert result == {}


class TestLintContent:
    def test_flags_console_log(self) -> None:
        findings = _lint_content("app.ts", "  console.log('debug')")
        assert any("console.log" in f for f in findings)

    def test_still_flags_console_log_with_inline_comment(self) -> None:
        findings = _lint_content("app.ts", "  console.log('debug') // intentional")
        assert any("console.log" in f for f in findings)

    def test_allows_console_log_not_at_line_start(self) -> None:
        findings = _lint_content("app.ts", "// console.log('commented out')")
        console_findings = [f for f in findings if "console.log" in f]
        assert console_findings == []

    def test_flags_bare_any(self) -> None:
        findings = _lint_content("app.ts", "const x: any = 1")
        assert any("any" in f for f in findings)

    def test_ignores_intentional_any(self) -> None:
        findings = _lint_content("app.ts", "const x: any // intentional: dynamic API")
        any_findings = [f for f in findings if "Bare `any`" in f]
        assert any_findings == []

    def test_flags_ts_ignore_without_reason(self) -> None:
        findings = _lint_content("app.ts", "// @ts-ignore\nconst x = 1")
        assert any("@ts-ignore" in f for f in findings)

    def test_allows_ts_ignore_with_reason(self) -> None:
        findings = _lint_content("app.ts", "// @ts-ignore -- legacy API types")
        ts_findings = [f for f in findings if "@ts-ignore" in f]
        assert ts_findings == []

    def test_flags_bare_todo(self) -> None:
        findings = _lint_content("app.ts", "// TODO fix this later")
        assert any("TODO" in f for f in findings)

    def test_allows_todo_with_issue(self) -> None:
        findings = _lint_content("app.ts", "// TODO(PROJ-123) fix this later")
        todo_findings = [f for f in findings if "Bare `TODO`" in f]
        assert todo_findings == []

    def test_flags_debugger(self) -> None:
        findings = _lint_content("app.ts", "debugger;")
        assert any("debugger" in f for f in findings)

    def test_flags_empty_file(self) -> None:
        findings = _lint_content("app.ts", "   ")
        assert any("empty" in f.lower() for f in findings)

    def test_clean_file_returns_empty(self) -> None:
        findings = _lint_content("app.ts", "export const x: string = 'hello';")
        assert findings == []


class TestPostWriteLint:
    async def test_skips_non_lintable_files(self) -> None:
        result = await post_write_lint(
            {"tool_input": {"file_path": "README.md", "content": "console.log('x')"}},
            None, None,
        )
        assert result == {}

    async def test_returns_findings_for_ts_file(self) -> None:
        result = await post_write_lint(
            {"tool_input": {"file_path": "app.tsx", "content": "debugger;"}},
            None, None,
        )
        assert "additionalContext" in result["hookSpecificOutput"]

    async def test_uses_new_string_for_edits(self) -> None:
        result = await post_write_lint(
            {"tool_input": {"file_path": "app.ts", "new_string": "debugger;"}},
            None, None,
        )
        assert "additionalContext" in result["hookSpecificOutput"]

    async def test_clean_content_returns_empty(self) -> None:
        result = await post_write_lint(
            {"tool_input": {"file_path": "app.ts", "content": "export const x = 1;"}},
            None, None,
        )
        assert result == {}
