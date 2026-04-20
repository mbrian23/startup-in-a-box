"""Per-run correlation ids for factory Python logs.

Mirrors ``orchestrator.logging_context`` so both services share a log
format and folder layout. Keeping it local (not importing from
orchestrator) avoids a cross-package runtime dependency between two
independently deployable services.
"""

from __future__ import annotations

from contextlib import contextmanager
from contextvars import ContextVar
from datetime import datetime, timezone
from typing import Iterator

thread_id_var: ContextVar[str | None] = ContextVar("thread_id", default=None)
run_id_var: ContextVar[str | None] = ContextVar("run_id", default=None)

boot_id: str = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")

_ran_once = False


def has_run_started_ever() -> bool:
    return _ran_once


@contextmanager
def run_scope(thread_id: str, run_id: str) -> Iterator[None]:
    global _ran_once
    _ran_once = True
    t_tok = thread_id_var.set(thread_id)
    r_tok = run_id_var.set(run_id)
    try:
        yield
    finally:
        thread_id_var.reset(t_tok)
        run_id_var.reset(r_tok)
