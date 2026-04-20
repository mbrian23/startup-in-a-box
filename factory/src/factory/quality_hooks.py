"""Claude Agent SDK hooks that enforce code quality on factory runs.

Three layers of enforcement:

1. ``pre_bash_guard``   — denies destructive / hook-skipping shell
   commands before they run (``rm -rf``, ``git push --force``,
   ``--no-verify``, etc.). The factory runs in ``acceptEdits`` mode,
   so without this guard an agent can wipe its own workspace.

2. ``rtk_rewrite``      — token-optimizing rewrite: if the ``rtk`` CLI
   (https://github.com/rtk-ai/rtk) is installed, delegates the Bash
   command through ``rtk rewrite`` which swaps ``git status`` →
   ``rtk git status`` (and similar) to compress output by 60-90%.
   No-op when ``rtk`` is absent, so the factory still works without it.

3. ``post_write_lint``  — after a ``Write``/``Edit`` to a TS/JS/TSX
   file, scans the content for quality smells (``console.log`` debug
   prints, bare ``any`` types, unjustified ``@ts-ignore`` /
   ``eslint-disable``) and pushes the findings back to the agent via
   ``additionalContext`` so the next turn fixes them.

Hooks return the SDK's ``SyncHookJSONOutput`` shape. Denials use the
``PreToolUseHookSpecificOutput`` branch with ``permissionDecision:
"deny"`` + a reason; guidance uses ``PostToolUseHookSpecificOutput``
with ``additionalContext``; rewrites use ``updatedInput``.
"""

from __future__ import annotations

import asyncio
import logging
import re
import shutil
from typing import Any

from claude_agent_sdk import HookMatcher

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Bash guard
# ---------------------------------------------------------------------------

# Patterns matched against the raw command string. Compiled once.
_BASH_DENY_PATTERNS: tuple[tuple[re.Pattern[str], str], ...] = (
    (
        re.compile(r"\brm\s+-[a-z]*r[a-z]*f[a-z]*\s+/"),
        "`rm -rf /...` wipes the host — use a scoped path or the Edit tool.",
    ),
    (
        re.compile(r"\brm\s+-[a-z]*r[a-z]*f[a-z]*\s+(\*|\.|~)(\s|$)"),
        "Broad recursive delete (`rm -rf *`, `.`, `~`) is not allowed — delete specific files.",
    ),
    (
        re.compile(r"git\s+push[^|&;]*(-f\b|--force\b)"),
        "Force-push is disallowed. Rebase cleanly or open a fresh branch.",
    ),
    (
        re.compile(r"git\s+reset\s+--hard"),
        "`git reset --hard` discards uncommitted work. Use `git stash` or commit first.",
    ),
    (
        re.compile(r"--no-verify\b"),
        "`--no-verify` skips hooks that enforce lint/tests. Fix the underlying issue instead.",
    ),
    (
        re.compile(r"--no-gpg-sign\b|--no-edit\b"),
        "Bypassing commit signing / edit review is disallowed.",
    ),
    (
        re.compile(r"\bsudo\b"),
        "`sudo` is disallowed inside factory workspaces.",
    ),
    (
        re.compile(r":\s*\(\s*\)\s*\{\s*:\|\s*:\s*&\s*\}\s*;\s*:"),
        "Fork bomb detected.",
    ),
)


async def pre_bash_guard(
    input_data: dict[str, Any],
    tool_use_id: str | None,
    context: Any,
) -> dict[str, Any]:
    """Deny destructive Bash invocations before they execute."""
    command = str((input_data.get("tool_input") or {}).get("command", ""))
    for pattern, reason in _BASH_DENY_PATTERNS:
        if pattern.search(command):
            return {
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "deny",
                    "permissionDecisionReason": reason,
                },
            }
    return {}


# ---------------------------------------------------------------------------
# RTK rewrite
# ---------------------------------------------------------------------------

# Cached path to the `rtk` binary. Sentinel means "never looked";
# `None` means "looked, not installed" (warning already logged).
_RTK_SENTINEL = object()
_RTK_PATH: str | None | object = _RTK_SENTINEL


def _locate_rtk() -> str | None:
    """Resolve the rtk binary path on first use, then cache the result."""
    global _RTK_PATH
    if _RTK_PATH is _RTK_SENTINEL:
        found = shutil.which("rtk")
        _RTK_PATH = found
        if found is None:
            logger.info(
                "rtk binary not found on PATH — command rewrite disabled. "
                "Install: `brew install rtk` or see https://github.com/rtk-ai/rtk",
            )
    return _RTK_PATH if isinstance(_RTK_PATH, str) else None


async def rtk_rewrite(
    input_data: dict[str, Any],
    tool_use_id: str | None,
    context: Any,
) -> dict[str, Any]:
    """Rewrite a Bash command through `rtk rewrite` for token savings.

    Exit code protocol (from rtk/hooks/claude/rtk-rewrite.sh):
      * 0 + stdout   — rewrite found, safe to auto-allow
      * 1            — no RTK equivalent, pass through unchanged
      * 2            — deny rule matched, pass through (let Claude Code deny)
      * 3 + stdout   — rewrite found but an "ask" rule matched; we still
                       take the rewrite and let permission prompts fire
                       naturally via the surrounding permission flow.

    The hook itself never denies — denials and approvals belong to the
    factory's permission layer (``can_use_tool`` / ``pre_bash_guard``).
    """
    rtk = _locate_rtk()
    if rtk is None:
        return {}

    command = str((input_data.get("tool_input") or {}).get("command", ""))
    if not command:
        return {}
    # Don't re-rewrite something that already goes through rtk — avoids
    # unbounded ping-pong if rtk's registry ever produces the same prefix.
    stripped = command.lstrip()
    if stripped.startswith("rtk "):
        return {}

    try:
        proc = await asyncio.create_subprocess_exec(
            rtk,
            "rewrite",
            command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL,
        )
        stdout_bytes, _ = await asyncio.wait_for(proc.communicate(), timeout=2.0)
    except (asyncio.TimeoutError, FileNotFoundError, OSError) as exc:
        logger.warning("rtk rewrite failed (%s) — passing command through", exc)
        return {}

    if proc.returncode not in (0, 3):
        return {}

    rewritten = stdout_bytes.decode("utf-8", errors="replace").strip()
    if not rewritten or rewritten == command:
        return {}

    return {
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "updatedInput": {**(input_data.get("tool_input") or {}), "command": rewritten},
        },
    }


# ---------------------------------------------------------------------------
# Post-write lint
# ---------------------------------------------------------------------------

_LINTABLE_SUFFIXES: tuple[str, ...] = (".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs")

# (pattern, message) — one line per finding so the agent can act on each.
# Each regex is compiled with MULTILINE so `^` anchors the start of a line.
_LINT_RULES: tuple[tuple[re.Pattern[str], str], ...] = (
    (
        re.compile(r"^\s*console\.log\b", re.MULTILINE),
        "`console.log` left in shipped code — remove or replace with a real logger.",
    ),
    (
        re.compile(r":\s*any\b(?!\s*//\s*intentional)"),
        "Bare `any` type — narrow it or annotate `// intentional: <reason>`.",
    ),
    (
        re.compile(r"@ts-ignore(?!\s*--)"),
        "`@ts-ignore` without a `-- <reason>` comment — explain why or fix the type.",
    ),
    (
        re.compile(r"eslint-disable(?:-next-line)?(?!\s+[\w@/-]+\s+--)"),
        "`eslint-disable` without a `<rule> -- <reason>` comment is not allowed.",
    ),
    (
        re.compile(r"\bTODO\b(?!\([A-Z]+-\d+\))"),
        "Bare `TODO` — either finish it now or link an issue: `TODO(PROJ-123)`.",
    ),
    (
        re.compile(r"\bdebugger\s*;"),
        "`debugger` statement left in source — remove before commit.",
    ),
)


def _lint_content(file_path: str, content: str) -> list[str]:
    findings: list[str] = []
    for pattern, message in _LINT_RULES:
        if pattern.search(content):
            findings.append(message)
    if content.strip() == "":
        findings.append("File is empty — write real content or delete the file.")
    return findings


async def post_write_lint(
    input_data: dict[str, Any],
    tool_use_id: str | None,
    context: Any,
) -> dict[str, Any]:
    """Scan written TS/JS content and push findings back to the agent."""
    tool_input = input_data.get("tool_input") or {}
    file_path = str(tool_input.get("file_path") or "")
    if not file_path.endswith(_LINTABLE_SUFFIXES):
        return {}

    # Write provides the full body; Edit only provides the patch, so we
    # lint `new_string` when it's an Edit.
    content = tool_input.get("content")
    if not isinstance(content, str):
        content = tool_input.get("new_string") or ""
    if not isinstance(content, str) or not content:
        return {}

    findings = _lint_content(file_path, content)
    if not findings:
        return {}

    bullets = "\n".join(f"  - {line}" for line in findings)
    message = (
        f"Quality review of `{file_path}` flagged the following. "
        f"Fix each in your next turn before moving on:\n{bullets}"
    )
    return {
        "hookSpecificOutput": {
            "hookEventName": "PostToolUse",
            "additionalContext": message,
        },
    }


# ---------------------------------------------------------------------------
# Bundled hook config
# ---------------------------------------------------------------------------

# ``matcher`` is a regex over tool names. We use alternation for multi-tool
# hooks (Write|Edit) to avoid double-registering the same callable.
QUALITY_HOOKS: dict[str, list[HookMatcher]] = {
    "PreToolUse": [
        # Ordering matters: guard first (deny destructive), then rewrite
        # (token compression). If the guard denies, the rewrite never
        # runs — the SDK short-circuits on the first deny.
        HookMatcher(matcher="Bash", hooks=[pre_bash_guard, rtk_rewrite]),
    ],
    "PostToolUse": [
        HookMatcher(matcher="Write|Edit", hooks=[post_write_lint]),
    ],
}
