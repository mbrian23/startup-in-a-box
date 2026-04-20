"""Per-run correlation ids for Python logs.

The ag-ui frontend logs carry ``thread_id``/``run_id`` inside every event.
These contextvars let the orchestrator stamp the same ids onto every
Python log record produced during a run, so ``grep run_id=<id>`` finds
every line from every component that participated in that run.
"""

from __future__ import annotations

from contextlib import contextmanager
from contextvars import ContextVar
from datetime import datetime, timezone
from typing import Iterator

thread_id_var: ContextVar[str | None] = ContextVar("thread_id", default=None)
run_id_var: ContextVar[str | None] = ContextVar("run_id", default=None)

# Process-unique boot id, generated once at module import. Lets us namespace
# _startup/ and _idle/ logs per-process-boot so successive restarts don't
# append to the same file. Compact UTC ISO so folders sort chronologically.
boot_id: str = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")

# Flips to True the first time any run_scope is entered. Used by the log
# handler to distinguish "startup" (before any run) from "idle" (between
# runs) when no thread_id is bound. Once True, stays True for process life.
_ran_once = False


def has_run_started_ever() -> bool:
    return _ran_once


@contextmanager
def run_scope(thread_id: str, run_id: str) -> Iterator[None]:
    """Bind thread_id/run_id to the current logical run."""
    global _ran_once
    _ran_once = True
    t_tok = thread_id_var.set(thread_id)
    r_tok = run_id_var.set(run_id)
    try:
        yield
    finally:
        thread_id_var.reset(t_tok)
        run_id_var.reset(r_tok)
