"""Structured logging for the factory service.

Mirrors the orchestrator's layout so both services write into the same
``<repo-root>/logs/<thread_id>/`` folder. When the orchestrator delegates
a run to the factory, their ``factory.jsonl`` and ``orchestrator.jsonl``
lines end up side by side in one directory — read the folder, see the
whole pipeline.
"""

from __future__ import annotations

import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import TextIO

from factory.logging_context import (
    boot_id,
    has_run_started_ever,
    run_id_var,
    thread_id_var,
)


def _repo_logs_root() -> Path:
    # .../factory/src/factory/logging_config.py  →  .../<repo-root>/logs
    return Path(__file__).resolve().parents[3] / "logs"


_STANDARD_ATTRS = {
    "name", "msg", "args", "levelname", "levelno", "pathname", "filename",
    "module", "exc_info", "exc_text", "stack_info", "lineno", "funcName",
    "created", "msecs", "relativeCreated", "thread", "threadName",
    "processName", "process", "message", "asctime", "taskName",
}


class _JsonFormatter(logging.Formatter):
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


class _ThreadRoutedFileHandler(logging.Handler):
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


def configure_logging() -> None:
    """Install stdout + thread-routed JSONL handlers on the root logger."""
    root = logging.getLogger()
    root.handlers.clear()
    stream = logging.StreamHandler(sys.stdout)
    stream.setFormatter(
        logging.Formatter(
            "%(asctime)s %(levelname)-8s %(name)s | %(message)s",
            datefmt="%H:%M:%S",
        )
    )
    root.addHandler(stream)
    logs_root = _repo_logs_root()
    logs_root.mkdir(exist_ok=True)
    root.addHandler(_ThreadRoutedFileHandler(logs_root, "factory"))
    root.setLevel(logging.INFO)
