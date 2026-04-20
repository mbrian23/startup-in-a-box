"""Structured logging helper.

Default is a human-readable stream for local development. When ``log_jsonl``
is on, ``configure_logging`` also writes newline-delimited JSON, one
folder per lifecycle phase and one file per component:

    logs/<thread_id>/<component>.jsonl         # inside a run_scope
    logs/_startup/<boot_id>/<component>.jsonl  # before the first run
    logs/_idle/<boot_id>/<component>.jsonl     # between runs after boot

The ``boot_id`` is a compact UTC timestamp generated once per process at
import time (see ``logging_context.boot_id``). Nesting by boot keeps
successive restarts' startup/idle traces separate, and every record —
including those inside a run folder — carries a ``boot_id`` field so
you can tell which process served a given run.
"""

from __future__ import annotations

import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import TYPE_CHECKING, TextIO

from orchestrator.logging_context import (
    boot_id,
    has_run_started_ever,
    run_id_var,
    thread_id_var,
)

if TYPE_CHECKING:
    from orchestrator.settings import Settings


def _repo_logs_root() -> Path:
    return Path(__file__).resolve().parents[3] / "logs"


class _JsonFormatter(logging.Formatter):
    """Newline-delimited JSON formatter.

    Matches the frontend's ag-ui log format on two axes that matter for
    cross-file correlation:
    - ``ts`` is UTC ISO-8601 with millisecond precision + ``Z`` suffix,
      so lines from every component sort together chronologically.
    - ``thread_id`` / ``run_id`` are stamped from ``run_scope`` contextvars
      when set, so ``grep run_id=<id>`` picks up every line from a run
      across orchestrator, ADK, factory, and ag-ui files.
    """

    def format(self, record: logging.LogRecord) -> str:
        created = datetime.fromtimestamp(record.created, tz=timezone.utc)
        ts = created.strftime("%Y-%m-%dT%H:%M:%S.") + f"{created.microsecond // 1000:03d}Z"
        payload: dict[str, object] = {
            "ts": ts,
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "boot_id": boot_id,
        }
        thread_id = thread_id_var.get()
        run_id = run_id_var.get()
        if thread_id is not None:
            payload["thread_id"] = thread_id
        if run_id is not None:
            payload["run_id"] = run_id
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        for key, value in record.__dict__.items():
            if key in _STANDARD_ATTRS or key.startswith("_"):
                continue
            payload[key] = value
        return json.dumps(payload, default=str)


_STANDARD_ATTRS = {
    "name", "msg", "args", "levelname", "levelno", "pathname", "filename",
    "module", "exc_info", "exc_text", "stack_info", "lineno", "funcName",
    "created", "msecs", "relativeCreated", "thread", "threadName",
    "processName", "process", "message", "asctime", "taskName",
}


class _ThreadRoutedFileHandler(logging.Handler):
    """Write each record to the folder that matches its lifecycle phase.

    Routes by the ``thread_id_var`` contextvar bound by ``run_scope``:
    - inside a run → ``logs/<thread_id>/<component>.jsonl``
    - no thread, but the process has already handled a run →
      ``logs/_idle/<component>.jsonl`` (session cleanup, health probes,
      CORS preflights, background chatter between runs)
    - no thread, and no run has ever started → ``logs/_startup/<component>.jsonl``
      (app factory, agent construction, ADK init — once per process boot)

    Per-bucket file handles are opened lazily and cached for the life of
    the process. At demo scale (tens of buckets per boot) this stays
    cheap; handles are closed on ``close()``.
    """

    # Nest by boot_id so successive process restarts don't append to the
    # same _startup/_idle files — each boot gets its own folder.
    _STARTUP_BUCKET = f"_startup/{boot_id}"
    _IDLE_BUCKET = f"_idle/{boot_id}"

    def __init__(self, logs_root: Path, component: str) -> None:
        super().__init__()
        self._root = logs_root
        self._component = component
        self._handles: dict[str, TextIO] = {}
        self.setFormatter(_JsonFormatter())

    def _open(self, bucket: str) -> TextIO:
        handle = self._handles.get(bucket)
        if handle is None:
            folder = self._root / bucket
            folder.mkdir(parents=True, exist_ok=True)
            handle = (folder / f"{self._component}.jsonl").open("a", encoding="utf-8")
            self._handles[bucket] = handle
        return handle

    def _bucket_for(self, thread_id: str | None) -> str:
        if thread_id:
            return thread_id
        return self._IDLE_BUCKET if has_run_started_ever() else self._STARTUP_BUCKET

    def emit(self, record: logging.LogRecord) -> None:
        try:
            bucket = self._bucket_for(thread_id_var.get())
            handle = self._open(bucket)
            handle.write(self.format(record) + "\n")
            handle.flush()
        except Exception:
            self.handleError(record)

    def close(self) -> None:
        for handle in self._handles.values():
            try:
                handle.close()
            except Exception:
                pass
        self._handles.clear()
        super().close()


def configure_logging(settings: Settings) -> None:
    """Install a single stream handler on the root logger.

    Idempotent: clearing handlers before re-installing lets tests call this
    repeatedly without stacking duplicate output.
    """
    root = logging.getLogger()
    root.handlers.clear()
    handler = logging.StreamHandler(sys.stdout)
    if settings.log_jsonl:
        handler.setFormatter(_JsonFormatter())
    else:
        handler.setFormatter(
            logging.Formatter(
                "%(asctime)s %(levelname)-8s %(name)s | %(message)s",
                datefmt="%H:%M:%S",
            )
        )
    root.addHandler(handler)
    if settings.log_jsonl:
        logs_root = _repo_logs_root()
        logs_root.mkdir(exist_ok=True)
        root.addHandler(_ThreadRoutedFileHandler(logs_root, "orchestrator"))
        _install_adk_handler(logs_root)
    root.setLevel(logging.INFO)


def _install_adk_handler(logs_root: Path) -> None:
    """Attach a thread-routed jsonl handler to Google ADK's ``google_adk`` logger.

    Elevates ``google_adk`` to DEBUG so transfer decisions and tool
    routing show up (INFO-level alone is nearly empty). Each record is
    filed under ``logs/<thread_id>/adk.jsonl`` next to the run's
    orchestrator / ag-ui / factory siblings, so one folder = one run.

    Propagation stays on — the root-level orchestrator handler still
    captures the INFO-level slice for the mixed view.
    """
    adk_logger = logging.getLogger("google_adk")
    adk_logger.addHandler(_ThreadRoutedFileHandler(logs_root, "adk"))
    adk_logger.setLevel(logging.DEBUG)
