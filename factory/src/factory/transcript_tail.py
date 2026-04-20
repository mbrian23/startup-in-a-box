"""Tail Claude Code session transcripts into the agent-flow SSE stream.

Claude Code writes a JSONL transcript for every session to
``~/.claude/projects/<cwd-slug>/<session-id>.jsonl`` — independent of
any configured hooks. Tailing it lets the visualizer observe the
factory's SDK subprocess even when tool hooks aren't firing (e.g.
while the CLI is still resolving a slash command or the model is
thinking with no tool calls yet).

Port of the core paths from ``patoles/agent-flow``'s
``extension/src/transcript-parser.ts`` and ``session-watcher.ts``:

* JSON-Lines parsing of ``user`` / ``assistant`` / ``progress`` entries
* Tool-use / tool-result pairing via ``tool_use_id``
* Subagent dispatch / return tracking (``Agent`` and ``Task`` tools,
  plus inline ``progress`` events that newer CLI versions emit)
* First-user-message session label
* Dedup of tool-use IDs and message hashes across reruns of the
  tailer (e.g. after reconnect)

Deliberately dropped from the upstream port because they're visual
polish rather than correctness:

* Token estimates and context-breakdown updates
* Permission-requested detection
* File-discovery enrichment on tool results
* Sidecar subagent file watching — the JSONL already carries inline
  ``progress`` events on current Claude Code versions

The tailer polls the JSONL (no watchdog dependency) so it works
identically on macOS and Linux containers. Poll interval is
deliberately short because the browser canvas is the user-visible
latency surface.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterable

from factory.agent_flow_events import (
    publish_agent_event,
    publish_session_ended,
    publish_session_started,
    publish_session_updated,
)

logger = logging.getLogger(__name__)


_POLL_INTERVAL_S = 0.25
_DISCOVERY_TIMEOUT_S = 60.0
_ORCHESTRATOR_NAME = "orchestrator"

# Truncation limits — matched to upstream so payload sizes stay
# consistent between the two event sources.
_ARGS_MAX = 80
_PREVIEW_MAX = 60
_RESULT_MAX = 200
_TASK_MAX = 60
_MESSAGE_MAX = 2000
_HASH_PREFIX_MAX = 200
_CHILD_NAME_MAX = 30
_SESSION_LABEL_MAX = 14
_SESSION_LABEL_TRUNCATED = _SESSION_LABEL_MAX - 2
_URL_PATH_MAX = 40
_SKILL_NAME_MAX = 40

_SYSTEM_CONTENT_PREFIXES = (
    "This session is being continued",
    "<ide_",
    "<system-reminder",
    "<available-deferred-tools",
    "<command-name",
    "<command-message",
    "<local-command-",
)


def _project_dir_for_cwd(cwd: Path) -> Path:
    """Return the ``~/.claude/projects/<slug>`` dir for a given cwd."""
    absolute = str(cwd.resolve())
    slug = absolute.replace("/", "-")
    return Path.home() / ".claude" / "projects" / slug


def _tail_path(file_path: str, segments: int = 2) -> str:
    return "/".join(str(file_path).split("/")[-segments:])


def _summarize_input(tool_name: str, tool_input: dict[str, Any] | None) -> str:
    if not tool_input:
        return ""
    try:
        if tool_name == "Bash":
            return str(tool_input.get("command", ""))[:_ARGS_MAX]
        if tool_name == "Read":
            return _tail_path(str(tool_input.get("file_path") or tool_input.get("path") or ""))
        if tool_name == "Edit":
            return _tail_path(str(tool_input.get("file_path", ""))) + " — edit"
        if tool_name == "Write":
            return _tail_path(str(tool_input.get("file_path", ""))) + " — write"
        if tool_name in ("Glob", "Grep"):
            return str(tool_input.get("pattern", ""))
        if tool_name in ("Task", "Agent"):
            description = tool_input.get("description") or tool_input.get("prompt") or ""
            return str(description)[:_TASK_MAX]
        if tool_name == "TodoWrite":
            todos = tool_input.get("todos")
            if isinstance(todos, list) and todos:
                active = next((t for t in todos if t.get("status") == "in_progress"), None)
                label = (active or {}).get("activeForm") or (active or {}).get("content") or todos[0].get("content", "todos")
                done = sum(1 for t in todos if t.get("status") == "completed")
                return f"{label} ({done}/{len(todos)})"[:_ARGS_MAX]
            return "updating todos"
        if tool_name == "WebSearch":
            return str(tool_input.get("query", ""))[:_ARGS_MAX]
        if tool_name == "WebFetch":
            url = str(tool_input.get("url", ""))
            try:
                from urllib.parse import urlparse

                parsed = urlparse(url)
                return (parsed.hostname or "") + (parsed.path or "")[:_URL_PATH_MAX]
            except Exception:
                return url[:_ARGS_MAX]
        if tool_name == "Skill":
            return str(tool_input.get("skill", ""))[:_SKILL_NAME_MAX]
        return json.dumps(tool_input, default=str)[:_ARGS_MAX]
    except Exception:
        return ""


def _summarize_result(content: Any) -> str:
    if isinstance(content, str):
        return content[:_RESULT_MAX]
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict) and "text" in item:
                parts.append(str(item["text"]))
        return "\n".join(parts)[:_RESULT_MAX]
    if isinstance(content, dict):
        if isinstance(content.get("content"), str):
            return content["content"][:_RESULT_MAX]
        if isinstance(content.get("text"), str):
            return content["text"][:_RESULT_MAX]
        try:
            return json.dumps(content, default=str)[:_RESULT_MAX]
        except Exception:
            return ""
    return str(content or "")[:_RESULT_MAX]


def _resolve_child_name(tool_input: dict[str, Any]) -> str:
    raw = tool_input.get("description") or tool_input.get("subagent_type") or "subagent"
    return str(raw)[:_CHILD_NAME_MAX]


def _is_system_injected(text: str) -> bool:
    return any(text.startswith(prefix) for prefix in _SYSTEM_CONTENT_PREFIXES)


@dataclass
class _PendingTool:
    name: str
    args: str


@dataclass
class _SubagentContext:
    """Dedup / pairing state for one inline-progress subagent.

    Newer Claude Code CLIs stream subagent turns into the parent JSONL
    as ``type: "progress"`` envelopes keyed by ``parentToolUseID``.
    Each subagent needs its own tool-use / message dedup so completing
    a parent tool doesn't clobber a pending subagent tool.
    """

    agent_name: str
    pending: dict[str, _PendingTool] = field(default_factory=dict)
    seen_tool_ids: set[str] = field(default_factory=set)
    seen_messages: set[str] = field(default_factory=set)


@dataclass
class _SessionState:
    thread_id: str
    session_id: str
    label: str
    label_set: bool = False
    started_at_s: float = field(default_factory=time.time)
    pending_tools: dict[str, _PendingTool] = field(default_factory=dict)
    seen_tool_ids: set[str] = field(default_factory=set)
    seen_messages: set[str] = field(default_factory=set)
    spawned_subagents: set[str] = field(default_factory=set)
    subagent_child_names: dict[str, str] = field(default_factory=dict)
    inline_subagents: dict[str, _SubagentContext] = field(default_factory=dict)
    ended: bool = False

    def elapsed(self) -> float:
        return max(0.0, time.time() - self.started_at_s)


class _TranscriptParser:
    def __init__(self, state: _SessionState) -> None:
        self._state = state

    def process_line(self, line: str) -> None:
        stripped = line.strip()
        if not stripped:
            return
        try:
            parsed = json.loads(stripped)
        except json.JSONDecodeError:
            return
        if not isinstance(parsed, dict):
            return

        entry_type = parsed.get("type")
        if entry_type == "progress":
            self._handle_progress(parsed)
            return
        if entry_type not in ("user", "assistant"):
            return

        message = parsed.get("message")
        if not isinstance(message, dict):
            return

        self._process_entry(
            parsed=parsed,
            message=message,
            agent_name=_ORCHESTRATOR_NAME,
            pending=self._state.pending_tools,
            seen_tool_ids=self._state.seen_tool_ids,
            seen_messages=self._state.seen_messages,
        )

    def _process_entry(
        self,
        *,
        parsed: dict[str, Any],
        message: dict[str, Any],
        agent_name: str,
        pending: dict[str, _PendingTool],
        seen_tool_ids: set[str],
        seen_messages: set[str],
    ) -> None:
        role = message.get("role")
        entry_uuid = parsed.get("uuid") if isinstance(parsed.get("uuid"), str) else None

        # Set the session label from the first real user message so the
        # visualizer tab shows something recognizable.
        if role in ("user", "human"):
            self._maybe_update_label(message)

        content = message.get("content")

        if isinstance(content, str):
            text = content.strip()
            if not text or _is_system_injected(text):
                return
            emit_role = "user" if role in ("user", "human") else "assistant"
            hash_key = f"{emit_role}:{entry_uuid or text[:_HASH_PREFIX_MAX]}"
            if hash_key in seen_messages:
                return
            seen_messages.add(hash_key)
            self._emit(
                "message",
                {
                    "agent": agent_name,
                    "role": emit_role,
                    "content": text[:_MESSAGE_MAX],
                },
            )
            return

        if not isinstance(content, list):
            return

        emit_role = "user" if role in ("user", "human") else "assistant"
        for block in content:
            if not isinstance(block, dict):
                continue
            block_type = block.get("type")
            if block_type == "tool_use":
                tool_id = block.get("id")
                if not isinstance(tool_id, str) or tool_id in seen_tool_ids:
                    continue
                seen_tool_ids.add(tool_id)
                self._handle_tool_use(block, agent_name, pending)
            elif block_type == "tool_result":
                self._handle_tool_result(block, agent_name, pending)
            elif block_type == "text":
                text = str(block.get("text", "")).strip()
                if not text:
                    continue
                if emit_role == "user" and _is_system_injected(text):
                    continue
                hash_key = f"{emit_role}:{entry_uuid or text[:_HASH_PREFIX_MAX]}"
                if hash_key in seen_messages:
                    continue
                seen_messages.add(hash_key)
                self._emit(
                    "message",
                    {
                        "agent": agent_name,
                        "role": emit_role,
                        "content": text[:_MESSAGE_MAX],
                    },
                )
            elif block_type == "thinking":
                thinking = str(block.get("thinking", "")).strip()
                if not thinking:
                    continue
                hash_key = f"thinking:{entry_uuid or thinking[:_HASH_PREFIX_MAX]}"
                if hash_key in seen_messages:
                    continue
                seen_messages.add(hash_key)
                self._emit(
                    "message",
                    {
                        "agent": agent_name,
                        "role": "thinking",
                        "content": thinking[:_MESSAGE_MAX],
                    },
                )

    def _handle_tool_use(
        self,
        block: dict[str, Any],
        agent_name: str,
        pending: dict[str, _PendingTool],
    ) -> None:
        tool_id = str(block.get("id", ""))
        tool_name = str(block.get("name", "unknown"))
        tool_input = block.get("input") if isinstance(block.get("input"), dict) else {}
        args = _summarize_input(tool_name, tool_input)
        pending[tool_id] = _PendingTool(name=tool_name, args=args)

        if tool_name in ("Task", "Agent"):
            child_name = _resolve_child_name(tool_input)
            self._state.subagent_child_names[tool_id] = child_name
            if child_name not in self._state.spawned_subagents:
                self._state.spawned_subagents.add(child_name)
                self._emit(
                    "subagent_dispatch",
                    {"parent": agent_name, "child": child_name, "task": args},
                )
                self._emit(
                    "agent_spawn",
                    {"name": child_name, "parent": agent_name, "task": args},
                )

        self._emit(
            "tool_call_start",
            {
                "agent": agent_name,
                "tool": tool_name,
                "args": args,
                "preview": f"{tool_name}: {args}"[:_PREVIEW_MAX],
                "inputData": tool_input,
            },
        )

    def _handle_tool_result(
        self,
        block: dict[str, Any],
        agent_name: str,
        pending: dict[str, _PendingTool],
    ) -> None:
        tool_use_id = block.get("tool_use_id")
        if not isinstance(tool_use_id, str):
            return
        pending_tool = pending.pop(tool_use_id, None)
        if pending_tool is None:
            return
        result = _summarize_result(block.get("content"))
        if pending_tool.name in ("Task", "Agent"):
            child_name = self._state.subagent_child_names.pop(
                tool_use_id,
                pending_tool.args[:_CHILD_NAME_MAX] or "subagent",
            )
            self._state.inline_subagents.pop(tool_use_id, None)
            self._emit(
                "subagent_return",
                {
                    "child": child_name,
                    "parent": agent_name,
                    "summary": result[:_ARGS_MAX],
                },
            )
            self._emit("agent_complete", {"name": child_name})

        self._emit(
            "tool_call_end",
            {
                "agent": agent_name,
                "tool": pending_tool.name,
                "result": result[:_RESULT_MAX],
            },
        )

    def _handle_progress(self, parsed: dict[str, Any]) -> None:
        """Route an inline subagent progress envelope back through ``_process_entry``.

        Each envelope contains a nested transcript entry in
        ``data.message`` keyed by ``parentToolUseID``. We keep a
        per-parent context so the subagent's tool calls pair up
        correctly even while the parent's own tools are still pending.
        """
        data = parsed.get("data")
        if not isinstance(data, dict) or data.get("type") != "agent_progress":
            return
        inner_entry = data.get("message")
        if not isinstance(inner_entry, dict):
            return
        inner_message = inner_entry.get("message")
        if not isinstance(inner_message, dict):
            return
        parent_tool_use_id = parsed.get("parentToolUseID")
        if not isinstance(parent_tool_use_id, str):
            return

        ctx = self._state.inline_subagents.get(parent_tool_use_id)
        if ctx is None:
            child_name = self._state.subagent_child_names.get(
                parent_tool_use_id,
                f"subagent-{parent_tool_use_id[-6:]}",
            )
            ctx = _SubagentContext(agent_name=child_name)
            self._state.inline_subagents[parent_tool_use_id] = ctx

        self._process_entry(
            parsed=inner_entry,
            message=inner_message,
            agent_name=ctx.agent_name,
            pending=ctx.pending,
            seen_tool_ids=ctx.seen_tool_ids,
            seen_messages=ctx.seen_messages,
        )

    def _maybe_update_label(self, message: dict[str, Any]) -> None:
        if self._state.label_set:
            return
        content = message.get("content")
        text: str | None = None
        if isinstance(content, str) and content.strip() and not _is_system_injected(content.strip()):
            text = content.strip()
        elif isinstance(content, list):
            for block in content:
                if isinstance(block, dict) and block.get("type") == "text":
                    candidate = str(block.get("text", "")).strip()
                    if candidate and not _is_system_injected(candidate):
                        text = candidate
                        break
        if not text:
            return
        first_line = text.split("\n", 1)[0].strip()
        label = (
            first_line
            if len(first_line) <= _SESSION_LABEL_MAX
            else first_line[:_SESSION_LABEL_TRUNCATED] + ".."
        )
        self._state.label = label
        self._state.label_set = True
        publish_session_updated(self._state.thread_id, self._state.session_id, label)

    def _emit(self, event_type: str, payload: dict[str, Any]) -> None:
        publish_agent_event(
            self._state.thread_id,
            {
                "time": self._state.elapsed(),
                "type": event_type,
                "payload": payload,
                "sessionId": self._state.session_id,
            },
        )


class TranscriptTail:
    """Async task that discovers and tails the active session JSONL.

    One instance per factory run, scoped to ``thread_id``. Call
    :meth:`start` on entry, :meth:`stop` on exit. The tail locks onto
    the first JSONL that appears in the project dir after startup —
    our factory spawns exactly one Claude Code subprocess per run, so
    that's the right transcript.
    """

    def __init__(self, thread_id: str, cwd: Path) -> None:
        self._thread_id = thread_id
        self._cwd = cwd
        self._project_dir = _project_dir_for_cwd(cwd)
        self._task: asyncio.Task[None] | None = None
        self._session: _SessionState | None = None
        self._parser: _TranscriptParser | None = None

    def start(self) -> None:
        if self._task is not None:
            return
        loop = asyncio.get_event_loop()
        self._task = loop.create_task(
            self._run(),
            name=f"transcript-tail[{self._thread_id}]",
        )

    async def stop(self) -> None:
        if self._task is None:
            return
        self._task.cancel()
        try:
            await self._task
        except (asyncio.CancelledError, Exception):
            pass
        self._task = None
        if self._session and not self._session.ended:
            self._session.ended = True
            publish_session_ended(self._thread_id, self._session.session_id)

    async def _run(self) -> None:
        try:
            transcript_path = await self._await_transcript()
            if transcript_path is None:
                return
            session_id = transcript_path.stem
            self._session = _SessionState(
                thread_id=self._thread_id,
                session_id=session_id,
                label=f"Factory {session_id[:8]}",
                started_at_s=time.time(),
            )
            self._parser = _TranscriptParser(self._session)
            publish_session_started(
                self._thread_id,
                session_id,
                self._session.label,
                int(time.time() * 1000),
            )
            publish_agent_event(
                self._thread_id,
                {
                    "time": 0.0,
                    "type": "agent_spawn",
                    "payload": {
                        "name": _ORCHESTRATOR_NAME,
                        "isMain": True,
                        "task": self._session.label,
                    },
                    "sessionId": session_id,
                },
            )
            await self._tail_file(transcript_path)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("agent-flow: transcript tail crashed")

    async def _await_transcript(self) -> Path | None:
        """Wait for a JSONL to appear in the project dir.

        The Claude Code CLI creates the project dir lazily on first
        session message, so we have to poll for both the dir and a
        non-empty ``*.jsonl`` inside it.
        """
        deadline = time.time() + _DISCOVERY_TIMEOUT_S
        logger.debug("agent-flow: watching %s for JSONL", self._project_dir)
        while time.time() < deadline:
            if self._project_dir.is_dir():
                candidate = self._pick_latest_jsonl()
                if candidate is not None:
                    logger.info("agent-flow: tailing %s", candidate)
                    return candidate
            await asyncio.sleep(_POLL_INTERVAL_S)
        logger.warning(
            "agent-flow: no transcript appeared in %s within %ss",
            self._project_dir,
            _DISCOVERY_TIMEOUT_S,
        )
        return None

    def _pick_latest_jsonl(self) -> Path | None:
        try:
            entries: list[tuple[float, Path]] = [
                (p.stat().st_mtime, p)
                for p in self._project_dir.glob("*.jsonl")
                if p.is_file()
            ]
        except OSError:
            return None
        if not entries:
            return None
        entries.sort(reverse=True)
        return entries[0][1]

    async def _tail_file(self, path: Path) -> None:
        assert self._parser is not None
        last_size = 0
        leftover = ""
        while True:
            try:
                stat = path.stat()
            except FileNotFoundError:
                await asyncio.sleep(_POLL_INTERVAL_S)
                continue

            if stat.st_size < last_size:
                # File was truncated — rare, but reset to keep parsing consistent.
                last_size = 0
                leftover = ""

            if stat.st_size > last_size:
                new_bytes = stat.st_size - last_size
                try:
                    with path.open("rb") as fh:
                        fh.seek(last_size)
                        chunk = fh.read(new_bytes)
                except OSError:
                    await asyncio.sleep(_POLL_INTERVAL_S)
                    continue
                last_size = stat.st_size
                text = leftover + chunk.decode("utf-8", errors="replace")
                lines = text.split("\n")
                leftover = lines.pop() if not text.endswith("\n") else ""
                self._dispatch_lines(lines)

            await asyncio.sleep(_POLL_INTERVAL_S)

    def _dispatch_lines(self, lines: Iterable[str]) -> None:
        assert self._parser is not None
        for line in lines:
            if not line.strip():
                continue
            try:
                self._parser.process_line(line)
            except Exception:
                logger.exception("agent-flow: parser failed on line (len=%d)", len(line))


__all__ = ["TranscriptTail"]
