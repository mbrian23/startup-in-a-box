"""Minimal AG-UI SSE emitter for the factory run.

Kept narrow on purpose: agent-flow owns the detailed visualization (tool
calls, transcripts, node graph) via Claude Code hooks. What we stream
here is a coarse progress feed for the orchestrator's HandoffChoreographer
and for log-file comparison against agent-flow's capture.

Event shape matches the AG-UI contract so the orchestrator code that
consumes it stays unchanged.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

logger = logging.getLogger(__name__)

_AGENT_TOOL_NAMES = frozenset({"Agent", "Task"})

# Keys on SDK `usage` dicts we care about forwarding. Anthropic's schema
# may grow — the UI only renders what's present, so forwarding a bounded
# allowlist keeps deltas small and avoids leaking internal debug fields.
_USAGE_KEYS: tuple[str, ...] = (
    "input_tokens",
    "output_tokens",
    "cache_read_input_tokens",
    "cache_creation_input_tokens",
)

_GITHUB_MARKER_RE = re.compile(r"FACTORY_GITHUB_URL:\s*(https://github\.com/\S+)")
_DEPLOY_MARKER_RE = re.compile(
    r"FACTORY_DEPLOYMENT_URL:\s*(https://[^\s]*\.vercel\.app\S*)"
)
_GITHUB_FALLBACK_RE = re.compile(r"https://github\.com/[^\s]+")
_DEPLOY_FALLBACK_RE = re.compile(r"https://[^\s]*\.vercel\.app\b[^\s]*")


def sse(event_type: str, payload: dict[str, Any]) -> str:
    return f"event: {event_type}\ndata: {json.dumps(payload)}\n\n"


def run_started(thread_id: str, run_id: str) -> str:
    return sse(
        "RUN_STARTED",
        {"type": "RUN_STARTED", "threadId": thread_id, "runId": run_id},
    )


def run_finished(thread_id: str, run_id: str, artifacts: list[dict]) -> str:
    return sse(
        "RUN_FINISHED",
        {
            "type": "RUN_FINISHED",
            "threadId": thread_id,
            "runId": run_id,
            "artifacts": artifacts,
        },
    )


def run_error(thread_id: str, run_id: str, message: str) -> str:
    return sse(
        "RUN_ERROR",
        {
            "type": "RUN_ERROR",
            "threadId": thread_id,
            "runId": run_id,
            "message": message,
        },
    )


def state_delta(delta: dict[str, Any], thread_id: str, run_id: str) -> str:
    ops = [{"op": "add", "path": f"/{k}", "value": v} for k, v in delta.items()]
    return sse(
        "STATE_DELTA",
        {
            "type": "STATE_DELTA",
            "threadId": thread_id,
            "runId": run_id,
            "delta": ops,
        },
    )


class ProgressTracker:
    """Translates Claude SDK messages into a coarse progress delta stream.

    Emits STATE_DELTA when: active subagent changes, a tool call starts,
    an artifact is written, cost/usage updates arrive on a ResultMessage,
    or a rate-limit event fires. Returns an empty list when the message
    doesn't warrant an emission.
    """

    def __init__(self, thread_id: str, run_id: str, steps_total: int) -> None:
        self._thread_id = thread_id
        self._run_id = run_id
        self._steps_total = steps_total
        self._steps_completed = 0
        self._tool_to_subagent: dict[str, str] = {}
        self._current_subagent: str | None = None
        self._files_written: dict[str, str] = {}
        self._github_url_emitted: str | None = None
        self._deployment_url_emitted: str | None = None
        # Running cost/usage totals. Each ResultMessage contributes
        # another cost; we surface the cumulative figure so the UI's
        # deploy panel matches the final invoice.
        self._cost_usd_total: float = 0.0
        self._usage_totals: dict[str, int] = {k: 0 for k in _USAGE_KEYS}
        self._num_turns_total: int = 0
        self._duration_ms_total: int = 0

    def _delta(self, delta: dict[str, Any]) -> str:
        return state_delta(delta, self._thread_id, self._run_id)

    @property
    def deployment_url(self) -> str | None:
        """The live deploy URL emitted by the devops subagent, if any.

        The devops subagent prints `FACTORY_DEPLOYMENT_URL: …` once
        `vercel --prod` succeeds. A run that ends without this set
        shipped nothing, even if message_count > 0 — runner.py uses this
        as a post-run sanity gate against the 429-looks-like-success bug.
        """
        return self._deployment_url_emitted

    def stderr_line(self, line: str) -> str | None:
        """Emit a cli_stderr delta for a line captured from the SDK subprocess.

        Pared down to non-empty lines so idle heartbeats from the CLI
        don't spam the SSE stream. The UI shows these as a live warning
        feed next to the deploy panel.
        """
        trimmed = line.rstrip()
        if not trimmed:
            return None
        return self._delta({"cli_stderr_line": trimmed})

    def translate(self, message: Any) -> list[str]:
        """Return zero or more SSE lines for this Claude SDK message."""
        out: list[str] = []

        # Terminal ResultMessage — carries per-run cost/usage accounting.
        # One is emitted at the end of each SDK turn; we accumulate across
        # turns so the UI shows cumulative cost.
        cost_delta = self._maybe_result_delta(message)
        if cost_delta is not None:
            out.append(cost_delta)

        # Rate-limit hints — surface so the UI can show "throttled" rather
        # than hang silently while the SDK backs off.
        rate_delta = self._maybe_rate_limit_delta(message)
        if rate_delta is not None:
            out.append(rate_delta)

        # Figure out which subagent (if any) this message belongs to.
        parent = getattr(message, "parent_tool_use_id", None)
        resolved = self._tool_to_subagent.get(parent) if parent else None

        # Emit a handoff delta when the active subagent changes.
        if resolved and resolved != self._current_subagent:
            self._current_subagent = resolved
            out.append(self._delta({"active_agent": resolved}))
        elif parent is None and self._current_subagent is not None:
            self._current_subagent = None
            out.append(self._delta({"active_agent": "factory"}))

        for block in getattr(message, "content", None) or []:
            block_type = getattr(block, "type", None)

            if block_type == "tool_use":
                tool_id = getattr(block, "id", "") or ""
                tool_name = getattr(block, "name", "") or ""
                tool_input = getattr(block, "input", {}) or {}

                # Subagent dispatch — remember the mapping so downstream
                # messages can be attributed to the right subagent.
                if tool_name in _AGENT_TOOL_NAMES and isinstance(tool_input, dict):
                    subagent = tool_input.get("subagent_type")
                    if subagent and tool_id:
                        self._tool_to_subagent[tool_id] = subagent
                        out.append(self._delta({"active_agent": subagent}))
                        self._current_subagent = subagent
                    continue

                # File writes → artifact delta (keeps the file manifest in
                # sync with what the orchestrator / frontend display).
                # Emit the CUMULATIVE files map every time: AG-UI STATE_DELTA
                # applies ``op: add /files`` as ``state.files = value``
                # (replacement, not merge), so sending only the new file
                # would wipe prior entries from the panel.
                if tool_name in ("Write", "Edit") and isinstance(tool_input, dict):
                    fp = tool_input.get("file_path") or ""
                    if fp:
                        status = "modified" if tool_name == "Edit" else "created"
                        prior = self._files_written.get(fp)
                        # Keep the strongest status: once a file has been
                        # Written it stays "created"; an Edit on a brand-new
                        # path shows as "modified".
                        if prior != status and prior != "created":
                            self._files_written[fp] = status
                        elif prior is None:
                            self._files_written[fp] = status
                        files_payload = {
                            path: {"status": s}
                            for path, s in self._files_written.items()
                        }
                        logger.info(
                            "factory.files emit: tool=%s fp=%s cumulative=%d paths=%s",
                            tool_name,
                            fp,
                            len(self._files_written),
                            sorted(self._files_written),
                        )
                        out.append(self._delta({"files": files_payload}))

                # Generic tool-call notice (coarse; agent-flow has the detail)
                out.append(
                    self._delta(
                        {
                            "last_tool": {
                                "name": tool_name,
                                "subagent": resolved or "factory",
                            }
                        }
                    ),
                )

            elif block_type == "tool_result":
                tool_id = getattr(block, "tool_use_id", "") or ""
                if tool_id in self._tool_to_subagent:
                    # Subagent dispatch finished → one BuildPlan step done.
                    # Cap at steps_total so provider retries / extra Agent
                    # calls don't push the bar past 100%.
                    self._tool_to_subagent.pop(tool_id, None)
                    if self._steps_completed < self._steps_total:
                        self._steps_completed += 1
                        logger.info(
                            "factory.progress tick: %d/%d",
                            self._steps_completed,
                            self._steps_total,
                        )
                        out.append(
                            self._delta(
                                {
                                    "progress": {
                                        "steps_completed": self._steps_completed,
                                        "steps_total": self._steps_total,
                                    }
                                },
                            ),
                        )

                text = _tool_result_text(getattr(block, "content", None))
                if text:
                    out.extend(self._scrape_deploy_urls(text))

            elif block_type == "text":
                # Fallback: if the supervisor's final assistant message
                # re-prints `FACTORY_DEPLOYMENT_URL: …` (or a subagent's
                # tool_result slipped past the scraper above), catch it
                # here too. Idempotent — _scrape_deploy_urls dedupes.
                text = getattr(block, "text", None)
                if isinstance(text, str) and text:
                    out.extend(self._scrape_deploy_urls(text))

        return out

    def _maybe_result_delta(self, message: Any) -> str | None:
        """Emit a cost/usage delta when a ResultMessage arrives.

        The SDK's ResultMessage carries per-turn billing metadata. Fields
        are optional — providers that don't bill (LM Studio, local models
        via ANTHROPIC_BASE_URL override) leave them as None, in which
        case we simply skip the emission.
        """
        if type(message).__name__ != "ResultMessage":
            return None

        changed = False
        cost = getattr(message, "total_cost_usd", None)
        if isinstance(cost, (int, float)) and cost > 0:
            self._cost_usd_total += float(cost)
            changed = True

        usage = getattr(message, "usage", None)
        if isinstance(usage, dict):
            for key in _USAGE_KEYS:
                val = usage.get(key)
                if isinstance(val, int):
                    self._usage_totals[key] += val
                    changed = True

        num_turns = getattr(message, "num_turns", None)
        if isinstance(num_turns, int) and num_turns > 0:
            self._num_turns_total += num_turns
            changed = True

        duration_ms = getattr(message, "duration_ms", None)
        if isinstance(duration_ms, int) and duration_ms > 0:
            self._duration_ms_total += duration_ms
            changed = True

        if not changed:
            return None

        return self._delta(
            {
                "cost_usd": round(self._cost_usd_total, 6),
                "usage": dict(self._usage_totals),
                "num_turns": self._num_turns_total,
                "duration_ms": self._duration_ms_total,
            },
        )

    def _maybe_rate_limit_delta(self, message: Any) -> str | None:
        """Surface rate-limit hints so the UI doesn't look frozen."""
        cls_name = type(message).__name__
        # Two shapes the SDK may emit: a dedicated RateLimitEvent, or a
        # StreamEvent whose .event carries a rate-limit payload. Both are
        # duck-typed here to avoid importing optional symbols that older
        # SDK versions don't expose.
        if cls_name == "RateLimitEvent":
            return self._delta(
                {
                    "rate_limit": {
                        "status": getattr(message, "status", "throttled"),
                        "resets_at": getattr(message, "resets_at", None),
                        "message": str(message)[:240],
                    }
                },
            )
        if cls_name == "StreamEvent":
            event = getattr(message, "event", None)
            event_type = getattr(event, "type", "") if event is not None else ""
            if "rate_limit" in str(event_type).lower():
                return self._delta(
                    {
                        "rate_limit": {
                            "status": "throttled",
                            "message": str(event)[:240],
                        }
                    },
                )
        return None

    def _scrape_deploy_urls(self, text: str) -> list[str]:
        emissions: list[str] = []

        gh_match = _GITHUB_MARKER_RE.search(text) or _GITHUB_FALLBACK_RE.search(text)
        if gh_match:
            url = gh_match.group(1) if gh_match.re is _GITHUB_MARKER_RE else gh_match.group(0)
            url = url.rstrip(".,)")
            if url != self._github_url_emitted:
                self._github_url_emitted = url
                emissions.append(
                    self._delta({"github_url": url, "deployment_stage": "pushing"})
                )

        dp_match = _DEPLOY_MARKER_RE.search(text) or _DEPLOY_FALLBACK_RE.search(text)
        if dp_match:
            url = dp_match.group(1) if dp_match.re is _DEPLOY_MARKER_RE else dp_match.group(0)
            url = url.rstrip(".,)")
            if url != self._deployment_url_emitted:
                self._deployment_url_emitted = url
                emissions.append(
                    self._delta({"deployment_url": url, "deployment_stage": "deployed"})
                )

        return emissions


def _tool_result_text(content: Any) -> str:
    """Flatten a ToolResultBlock.content value to a single text blob."""
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, dict):
                txt = item.get("text")
                if isinstance(txt, str):
                    parts.append(txt)
        return "\n".join(parts)
    return ""
