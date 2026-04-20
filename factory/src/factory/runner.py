"""Run a BuildPlan through the Claude Agent SDK and stream AG-UI events.

The visualization lives in agent-flow (Claude Code hooks → node graph).
What this module streams is a coarse progress feed so the orchestrator's
HandoffChoreographer and the ag-ui-log comparison can keep working.
"""

from __future__ import annotations

import asyncio
import logging
import os
import shutil
import uuid
from pathlib import Path
from typing import Any, AsyncIterator

from claude_agent_sdk import (
    ClaudeAgentOptions,
    ClaudeSDKClient,
    ClaudeSDKError,
    CLIConnectionError,
    CLIJSONDecodeError,
    CLINotFoundError,
    ProcessError,
)

from factory.agent_flow_events import release_broker
from factory.transcript_tail import TranscriptTail

from factory.settings import Settings
from factory.stream import (
    ProgressTracker,
    run_error,
    run_finished,
    run_started,
    state_delta,
)
from factory.quality_hooks import QUALITY_HOOKS
from factory.subagents import SUBAGENTS
from factory.validation import BuildPlan

logger = logging.getLogger(__name__)


# The Claude Code preset carries Anthropic's tool-use guidance (when to
# use Read vs Glob, how to chain tool calls, error-handling norms). The
# text below is *appended* onto it — kept to cross-run supervisor rules
# that benefit from system-prompt caching. Per-run content (canvas,
# build plan, idea) rides in the user prompt via `client.query()`, and
# each subagent's own role/scope comes from its `AgentDefinition` in
# `subagents.py`, so we don't repeat the roster here.
SYSTEM_PROMPT_APPEND = """You are the factory supervisor. You ship a Next.js app \
from a structured BuildPlan by delegating every step to a subagent via the \
Agent tool. Never write code yourself — pick the right subagent, hand it the \
step's title / description / outputs / tool_hints as the prompt, then move on.

If a Lean Canvas is included in the user prompt, it is the ground truth: \
every page copy line, every mock-feature label, every pricing tier, every \
marketing headline tracks what is sealed on it. If the canvas and the build \
plan disagree, the canvas wins. Pass the canvas forward to subagents whenever \
it's relevant to the step they're executing.

Work through the steps in order. The run succeeds when the devops subagent \
completes a production `vercel --prod` deploy and prints the real Vercel URL \
after the `FACTORY_DEPLOYMENT_URL:` marker.

There is no human in this loop. `AskUserQuestion`, device-code auth flows, \
`vercel login`, and any other tool that waits on an interactive answer are \
unavailable — if you call them the run hangs until the idle budget expires. \
If a step needs a credential that isn't in the environment, do not ask the \
user and do not start an interactive login. Print a single line starting \
with `FACTORY_BLOCKED:` that names the missing credential, then stop. The \
runner will surface that to the operator cleanly. When `$VERCEL_TOKEN` is \
set, always pass `--token $VERCEL_TOKEN --yes` to `vercel` invocations so \
the CLI stays non-interactive. The DEPLOY MODE section at the bottom of \
the build plan tells you which credentials are available — obey it."""


_FACTORY_SKILLS_DIR = Path(__file__).resolve().parents[2] / "skills"


def _ensure_workspace(workspace: Path, repo_root: Path) -> None:
    # `run_build_plan_stream` is the single entry point for a factory run,
    # and each run gets its own thread_id — so if the workspace already
    # has non-.claude content, it's leftovers from a prior interrupted
    # run at the same thread_id. Clear it so `_collect_artifacts()` below
    # doesn't report files this run never produced. `.claude/` is handled
    # separately (symlink reset + fresh skills install).
    if workspace.exists():
        for child in workspace.iterdir():
            if child.name == ".claude":
                continue
            try:
                if child.is_dir() and not child.is_symlink():
                    shutil.rmtree(child)
                else:
                    child.unlink()
            except OSError:
                logger.warning("could not remove stale workspace entry: %s", child)

    workspace.mkdir(parents=True, exist_ok=True)
    claude_dir = workspace / ".claude"
    # If a prior run symlinked .claude into the repo's .claude, replace it
    # with a workspace-local directory. Sharing .claude leaks hook-driven
    # state back into the dev session.
    if claude_dir.is_symlink():
        claude_dir.unlink()
    claude_dir.mkdir(exist_ok=True)
    _install_skills(claude_dir / "skills")


def _install_skills(skills_dir: Path) -> None:
    """Symlink factory/skills/* into <workspace>/.claude/skills/.

    Keeps each workspace pointing at the canonical skill sources so
    edits in factory/skills/ show up on the next run without copying.
    Falls back to a plain copy on filesystems without symlink support.
    """
    skills_dir.mkdir(exist_ok=True)
    if not _FACTORY_SKILLS_DIR.is_dir():
        return
    for source in _FACTORY_SKILLS_DIR.iterdir():
        if not source.is_dir():
            continue
        dest = skills_dir / source.name
        if dest.exists() or dest.is_symlink():
            continue
        try:
            dest.symlink_to(source, target_is_directory=True)
        except OSError:
            import shutil
            shutil.copytree(source, dest)


_CANVAS_BLOCKS = (
    "problem",
    "customer_segments",
    "unique_value_proposition",
    "solution",
    "channels",
    "revenue_streams",
    "cost_structure",
    "key_metrics",
    "unfair_advantage",
)


def _format_canvas(canvas: dict[str, Any]) -> list[str]:
    """Render Yara's 9-block canvas as the prompt preamble.

    Each block is headline + bullets. Stable ordering keeps the prompt
    text cache-friendly across runs.
    """
    lines = ["LEAN CANVAS (ground truth — every page decision tracks this):"]
    for key in _CANVAS_BLOCKS:
        block = canvas.get(key)
        if not isinstance(block, dict):
            continue
        label = key.replace("_", " ").title()
        headline = block.get("headline") or ""
        lines.append(f"  {label}: {headline}")
        for bullet in block.get("bullets") or []:
            lines.append(f"    - {bullet}")
    lines.append("")
    return lines


def _format_market(market_analysis: dict[str, Any]) -> list[str]:
    """Render Marcus's market analysis as positioning context.

    Only the `analysis` field is prose the subagents can use — the
    `thought_bubble` is UI copy, not a planning input. If the analysis
    is missing or empty, return nothing so the prompt stays tight.
    """
    analysis = market_analysis.get("analysis")
    if not isinstance(analysis, str) or not analysis.strip():
        return []
    return [
        "MARKET CONTEXT (Marcus's research — use for positioning, "
        "competitor framing, and copy that names the real alternatives):",
        analysis.strip(),
        "",
    ]


def _prompt_for_plan(
    build_plan: BuildPlan,
    *,
    can_deploy: bool = True,
    can_push: bool = True,
) -> str:
    plan_lines: list[str] = []
    if build_plan.lean_canvas:
        plan_lines.extend(_format_canvas(build_plan.lean_canvas))
    if build_plan.market_analysis:
        plan_lines.extend(_format_market(build_plan.market_analysis))
    plan_lines.append(f"BUILD PLAN: {build_plan.summary}")
    plan_lines.append(f"Tech stack: {build_plan.tech_stack}")
    plan_lines.append("")
    if build_plan.brand:
        plan_lines.append(f"Brand context: {build_plan.brand}")
        plan_lines.append("")
    plan_lines.append("Steps:")
    for i, step in enumerate(build_plan.steps, 1):
        plan_lines.append(f"{i}. [{step.id}] {step.title} — {step.description}")
        if step.outputs:
            plan_lines.append(f"   produces: {', '.join(step.outputs)}")
    plan_lines.append("")
    if can_deploy and can_push:
        plan_lines.append(
            "Delegate each step to a subagent — pass the step's title, "
            "description, and `produces` list verbatim in the prompt, plus "
            "whatever slice of the canvas / market context / brand the "
            "subagent needs to do its job. Subagents choose their own tools. "
            "Work through steps in order. Finish with the devops subagent, "
            "which ships to GitHub + Vercel and prints the live URL after "
            "FACTORY_DEPLOYMENT_URL:."
        )
    else:
        plan_lines.append(
            "Delegate each step to a subagent — pass the step's title, "
            "description, and `produces` list verbatim in the prompt, plus "
            "whatever slice of the canvas / market context / brand the "
            "subagent needs to do its job. Subagents choose their own tools. "
            "Work through steps in order."
        )
        if not can_push and not can_deploy:
            plan_lines.append(
                "\nDEPLOY MODE: local-only. $GITHUB_TOKEN and $VERCEL_TOKEN "
                "are not set. Skip the devops subagent entirely — do NOT "
                "call gh, git push, or vercel. The built site is in the "
                "workspace directory and will be served from there."
            )
        elif not can_push:
            plan_lines.append(
                "\nDEPLOY MODE: Vercel-only. $GITHUB_TOKEN is not set — "
                "skip `gh repo create` and `git push`. Still run the devops "
                "subagent for `git init`, commit, and Vercel deploy."
            )
        elif not can_deploy:
            plan_lines.append(
                "\nDEPLOY MODE: GitHub-only. $VERCEL_TOKEN is not set — "
                "skip all `vercel` commands. Still run the devops subagent "
                "for `git init`, commit, and `gh repo create --push`."
            )
    return "\n".join(plan_lines)


def _build_env(settings: Settings) -> dict[str, str]:
    env = dict(os.environ)
    if settings.anthropic_api_key:
        env["ANTHROPIC_API_KEY"] = settings.anthropic_api_key
    if settings.anthropic_base_url:
        env["ANTHROPIC_BASE_URL"] = settings.anthropic_base_url
    if settings.vercel_token:
        env["VERCEL_TOKEN"] = settings.vercel_token
    # Bound Bash tool execution so hung commands (npm install, git clone,
    # psql with bad DSN) can't stall the run indefinitely. 120s default
    # matches factory/docs/tasks/07-software-factory.md; the 600s ceiling
    # leaves room for legitimate cold installs. `setdefault` keeps any
    # operator override from a parent shell.
    env.setdefault("BASH_DEFAULT_TIMEOUT_MS", "120000")
    env.setdefault("BASH_MAX_TIMEOUT_MS", "600000")
    return env


_RATE_LIMIT_NEEDLES = (
    "rate_limit_error",
    "rate limit",
    "tokens per minute",
    "tpm limit",
    "429",
    "too many tokens",
)

_OVERLOADED_NEEDLES = (
    "overloaded_error",
    "overloaded",
)


def _detect_rate_limit(stderr_lines: list[str]) -> str | None:
    """Spot silent Anthropic throttling in the captured CLI stderr.

    The SDK retries 429s internally and often exits cleanly after giving
    up, which means the run reaches `message_count > 0` and falls through
    to the RUN_FINISHED happy path — the user sees "pipeline completed"
    despite no deploy. This helper lets the caller promote that to a
    RUN_ERROR.
    """
    joined = "\n".join(stderr_lines).lower()
    if any(needle in joined for needle in _RATE_LIMIT_NEEDLES):
        return (
            "Anthropic rate limit hit mid-run (too many tokens at once). "
            "The factory exhausted its budget before the deploy. Wait a "
            "few minutes and retry, or narrow the build plan."
        )
    if any(needle in joined for needle in _OVERLOADED_NEEDLES):
        return (
            "Anthropic API was overloaded during the run. Retry in a "
            "few minutes."
        )
    return None


def _detect_cli_failure(stderr_lines: list[str]) -> str:
    """Classify a zero-message SDK run from the CLI's stderr output.

    The bundled Claude Code CLI emits one-line errors for common
    failure modes (billing, auth, network) and then exits cleanly,
    which the SDK treats as a normal end-of-response. We scan the
    captured stderr for the most useful line and return a message the
    frontend can display verbatim.
    """
    joined = "\n".join(stderr_lines).strip()
    haystack = joined.lower()
    if "credit balance is too low" in haystack:
        return (
            "Credit balance is too low. Top up your Anthropic account — "
            "the agents don't work pro bono."
        )
    if "invalid api key" in haystack or "authentication" in haystack:
        return "Claude Code authentication failed — check ANTHROPIC_API_KEY."
    if "rate limit" in haystack:
        return "Anthropic rate limit hit — wait a moment and retry."
    if joined:
        # Surface whatever the CLI printed verbatim, trimmed to
        # something reasonable for a UI toast.
        return joined.splitlines()[-1][:240]
    return (
        "Factory run produced no output. Check the factory logs "
        "(usually an auth, billing, or model-config issue)."
    )


def _collect_artifacts(workspace: Path) -> list[dict[str, Any]]:
    artifacts: list[dict[str, Any]] = []
    for path in sorted(workspace.rglob("*")):
        if path.is_file() and ".claude" not in path.parts:
            rel = path.relative_to(workspace)
            artifacts.append(
                {"type": "file", "path": str(rel), "size": path.stat().st_size},
            )
    return artifacts


async def run_build_plan_stream(
    build_plan: BuildPlan,
    settings: Settings,
    thread_id: str,
) -> AsyncIterator[str]:
    """Execute the BuildPlan and yield AG-UI SSE lines."""
    run_id = str(uuid.uuid4())
    workspace = Path(settings.workspace_root) / thread_id
    repo_root = Path(settings.repo_root)
    _ensure_workspace(workspace, repo_root)

    tracker = ProgressTracker(thread_id, run_id, len(build_plan.steps))

    yield run_started(thread_id, run_id)

    can_deploy = bool(settings.vercel_token or os.environ.get("VERCEL_TOKEN"))
    can_push = bool(os.environ.get("GITHUB_TOKEN"))
    if not can_deploy:
        logger.warning("VERCEL_TOKEN is unset — factory will build locally only (no deploy)")
    if not can_push:
        logger.warning("GITHUB_TOKEN is unset — factory will skip GitHub push")
    initial_state: dict[str, Any] = {
        "active_agent": "factory",
        "workspace": str(workspace),
        "progress": {"steps_completed": 0, "steps_total": len(build_plan.steps)},
    }
    # Re-seed boardroom artifacts so their UI tabs stay populated through
    # the factory phase (the orchestrator's state is not shared with this
    # run — anything the tabs need must ride in the factory's stream).
    if build_plan.market_analysis:
        initial_state["market_analysis"] = build_plan.market_analysis
    if build_plan.lean_canvas:
        initial_state["lean_canvas"] = build_plan.lean_canvas
    if build_plan.brand:
        initial_state["brand"] = build_plan.brand
    yield state_delta(initial_state, thread_id, run_id)

    # Caveman — compresses agent output ~75%. Ships with SessionStart +
    # UserPromptSubmit hooks that activate the terse mode for the whole
    # factory run. Vendored at factory/vendor/caveman.
    caveman_path = repo_root / "factory" / "vendor" / "caveman"

    # Only register vendored plugins that are actually present. Missing
    # directories mean the submodule / clone hasn't been populated; we
    # skip rather than hard-fail so the run degrades gracefully.
    vendored_plugins: list[dict[str, str]] = []
    for label, path in (("caveman", caveman_path),):
        if path.is_dir():
            vendored_plugins.append({"type": "local", "path": str(path)})
        else:
            logger.warning("%s plugin missing at %s — skipping", label, path)

    # Capture the Claude Code CLI's stderr for two uses:
    # 1. Live pipe into the AG-UI stream as `cli_stderr_line` deltas so
    #    warnings surface in the UI as they happen.
    # 2. Post-mortem classification in `_detect_cli_failure` for the
    #    zero-message case (billing / auth / rate-limit).
    # The SDK may invoke this callback off the asyncio loop (reader
    # thread), so we avoid asyncio primitives here — `list.append` is
    # atomic in CPython and the main loop drains by index below.
    cli_stderr: list[str] = []

    def _capture_stderr(line: str) -> None:
        cli_stderr.append(line)

    options = ClaudeAgentOptions(
        model=settings.factory_model,
        # Layer the factory supervisor role on top of Claude Code's
        # built-in tool-use guidance instead of replacing it.
        system_prompt={
            "type": "preset",
            "preset": "claude_code",
            "append": SYSTEM_PROMPT_APPEND,
        },
        cwd=str(workspace),
        env=_build_env(settings),
        # No ambient settings: the factory configures plugins, agents,
        # tools, and env explicitly below. Reading user/project settings
        # would pull in the dev machine's Claude Code config and re-leak
        # state into this session.
        setting_sources=[],
        # Intentionally no `add_dirs`: the SDK is confined to `cwd`
        # (the per-run workspace) so a subagent can't reach out and edit
        # `frontend/` or other deployed code. Any repo asset the run needs
        # must be symlinked into the workspace (see `_install_skills`).
        agents=SUBAGENTS,
        allowed_tools=["Agent", "Read", "Write", "Edit", "Glob", "Grep", "Bash"],
        permission_mode="acceptEdits",
        plugins=vendored_plugins,
        hooks=QUALITY_HOOKS,
        stderr=_capture_stderr,
    )

    # The tailer watches ~/.claude/projects/<cwd-slug>/<session-id>.jsonl
    # for the subprocess we're about to spawn. Started before the SDK
    # so the first lines are captured even if the CLI writes quickly.
    tail = TranscriptTail(thread_id=thread_id, cwd=workspace)
    tail.start()

    message_count = 0
    stderr_cursor = 0
    try:
        async with ClaudeSDKClient(options=options) as client:
            await client.query(
                _prompt_for_plan(
                    build_plan, can_deploy=can_deploy, can_push=can_push,
                )
            )
            async for message in client.receive_response():
                message_count += 1
                # Drain any stderr lines captured since the last message
                # so they interleave with the progress stream in order.
                # Snapshot `len` once — the callback thread may keep
                # appending while we iterate, and those show up next turn.
                stderr_end = len(cli_stderr)
                while stderr_cursor < stderr_end:
                    sse = tracker.stderr_line(cli_stderr[stderr_cursor])
                    stderr_cursor += 1
                    if sse is not None:
                        yield sse
                for line in tracker.translate(message):
                    yield line
    except CLINotFoundError as exc:
        logger.exception("claude code CLI missing")
        yield run_error(
            thread_id,
            run_id,
            f"Claude Code CLI is not installed or not on PATH: {exc}",
        )
        yield run_finished(thread_id, run_id, [])
        await tail.stop()
        await release_broker(thread_id)
        return
    except CLIConnectionError as exc:
        logger.exception("claude code CLI connection error")
        yield run_error(
            thread_id,
            run_id,
            f"Lost connection to the Claude Code CLI: {exc}",
        )
        yield run_finished(thread_id, run_id, [])
        await tail.stop()
        await release_broker(thread_id)
        return
    except ProcessError as exc:
        logger.exception("claude code CLI process error")
        # `_detect_cli_failure` picks the most useful stderr line; billing
        # and auth errors land here because the CLI exits non-zero.
        detail = _detect_cli_failure(cli_stderr) or f"Factory CLI exited abnormally: {exc}"
        yield run_error(thread_id, run_id, detail)
        yield run_finished(thread_id, run_id, [])
        await tail.stop()
        await release_broker(thread_id)
        return
    except CLIJSONDecodeError as exc:
        logger.exception("claude code CLI emitted malformed JSON")
        yield run_error(
            thread_id,
            run_id,
            f"Factory CLI produced a malformed message frame: {exc}",
        )
        yield run_finished(thread_id, run_id, [])
        await tail.stop()
        await release_broker(thread_id)
        return
    except ClaudeSDKError as exc:
        # Catch-all for future SDK-specific errors that don't match the
        # branches above. Distinguishing these from unrelated exceptions
        # keeps the UI message specific.
        logger.exception("claude agent sdk error")
        yield run_error(thread_id, run_id, f"Claude Agent SDK error: {exc}")
        yield run_finished(thread_id, run_id, [])
        await tail.stop()
        await release_broker(thread_id)
        return
    except asyncio.CancelledError:
        # The consumer disconnected. Let the cancellation propagate so
        # the surrounding task tree unwinds cleanly; the outer `finally`
        # in the caller handles release if needed.
        logger.info("factory run cancelled (client disconnected)")
        await tail.stop()
        await release_broker(thread_id)
        raise
    except Exception as exc:
        # Genuinely unexpected — not an SDK surface error. Keep the
        # broad catch so the stream doesn't die silently, but log it
        # loudly so we can add a typed handler next time.
        logger.exception("factory run failed with an unexpected error")
        yield run_error(thread_id, run_id, f"Unexpected factory error: {exc}")
        yield run_finished(thread_id, run_id, [])
        await tail.stop()
        await release_broker(thread_id)
        return

    if message_count == 0:
        detail = _detect_cli_failure(cli_stderr)
        logger.error("factory run produced no messages (%s)", detail)
        yield run_error(thread_id, run_id, detail)
        yield run_finished(thread_id, run_id, [])
        await tail.stop()
        await release_broker(thread_id)
        return

    # Post-run gate: when deploy credentials are present, the run only
    # truly succeeds when the devops subagent prints FACTORY_DEPLOYMENT_URL.
    # In local-only mode (no VERCEL_TOKEN) we skip this check — the built
    # site lives in the workspace directory.
    if can_deploy and tracker.deployment_url is None:
        rate_limit_detail = _detect_rate_limit(cli_stderr)
        if rate_limit_detail is not None:
            detail = rate_limit_detail
        else:
            detail = (
                "Factory finished without a deployment URL. The supervisor "
                "likely exhausted its budget or gave up silently. Check "
                "factory logs for the final state."
            )
        logger.error("factory run ended without deploy: %s", detail)
        yield run_error(thread_id, run_id, detail)
        yield run_finished(thread_id, run_id, [])
        await tail.stop()
        await release_broker(thread_id)
        return

    artifacts = _collect_artifacts(workspace)
    yield state_delta(
        {
            "progress": {
                "steps_completed": len(build_plan.steps),
                "steps_total": len(build_plan.steps),
            },
        },
        thread_id,
        run_id,
    )
    yield run_finished(thread_id, run_id, artifacts)
    await tail.stop()
    await release_broker(thread_id)
