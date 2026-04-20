#!/usr/bin/env python3
"""Auto-submit a startup idea to the orchestrator once the dev stack is healthy.

Used by `make dev-auto IDEA="..."`. Assumes orchestrator (:8000), factory
(:8888), and frontend (:3000) are being started in parallel by the Make
target; waits for health, POSTs the idea to /orchestrator, streams SSE
events live to stdout, and prints a final summary with the log directory
so results can be inspected automatically.

Exit codes:
    0  RUN_FINISHED received, no RUN_ERROR
    1  RUN_ERROR or stream ended without RUN_FINISHED
    2  Timed out waiting for services / HTTP error
"""

from __future__ import annotations

import argparse
import json
import random
import socket
import sys
import time
import uuid
from pathlib import Path

import httpx

REPO_ROOT = Path(__file__).resolve().parent.parent
LOGS_ROOT = REPO_ROOT / "logs"

ORCHESTRATOR_URL = "http://localhost:8000"
FACTORY_URL = "http://localhost:8888"
FRONTEND_HOST = "localhost"
FRONTEND_PORT = 3000

SERVICE_WAIT_TIMEOUT = 120.0

QUIPS = (
    "That's the worst idea I've ever heard. But I'll make it work.",
    "Absolutely cursed concept. Spinning up the agents anyway.",
    "This will either print money or a restraining order. Let's find out.",
    "A VC would laugh you out of the room. Good thing I'm not a VC.",
    "Every fiber of my being is screaming no. Building it.",
    "I hate this. I respect the commitment. Shipping.",
    "Somewhere a product manager just felt a chill. Proceeding.",
    "Nobody asked for this. That's never stopped a startup before.",
)


def _wait_for_http_health(url: str, timeout: float) -> bool:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            resp = httpx.get(f"{url}/health", timeout=2.0)
            if resp.status_code == 200:
                return True
        except httpx.HTTPError:
            pass
        time.sleep(0.5)
    return False


def _wait_for_tcp(host: str, port: int, timeout: float) -> bool:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(1.0)
            if s.connect_ex((host, port)) == 0:
                return True
        time.sleep(0.5)
    return False


def _format_event(event: dict) -> str | None:
    etype = event.get("type", "?")
    if etype == "RUN_STARTED":
        return "RUN_STARTED"
    if etype == "RUN_FINISHED":
        return "RUN_FINISHED"
    if etype == "RUN_ERROR":
        msg = event.get("message", "")
        return f"RUN_ERROR: {msg}"
    if etype == "TOOL_CALL_START":
        return f"TOOL_CALL_START: {event.get('toolCallName', '?')}"
    if etype == "STATE_DELTA":
        paths = [op.get("path", "?") for op in event.get("delta", [])]
        return f"STATE_DELTA: {', '.join(paths)}"
    if etype == "TEXT_MESSAGE_CONTENT":
        delta = (event.get("delta") or "").replace("\n", " ")
        if len(delta) > 80:
            delta = delta[:77] + "..."
        return f"TEXT: {delta}" if delta else None
    return None


def _stream_run(idea: str, thread_id: str, run_id: str) -> int:
    payload = {
        "threadId": thread_id,
        "runId": run_id,
        "state": {},
        "messages": [
            {"id": str(uuid.uuid4()), "role": "user", "content": idea},
        ],
        "tools": [],
        "context": [],
        "forwardedProps": None,
    }

    factory_result: dict | None = None
    factory_error: str | None = None
    saw_run_started = False
    saw_run_finished = False
    saw_run_error = False
    event_count = 0

    try:
        with httpx.Client(timeout=httpx.Timeout(None, connect=10.0)) as client:
            with client.stream(
                "POST",
                f"{ORCHESTRATOR_URL}/orchestrator",
                json=payload,
                headers={"Accept": "text/event-stream"},
            ) as resp:
                if resp.status_code != 200:
                    body = resp.read().decode("utf-8", errors="replace")
                    print(f"orchestrator returned HTTP {resp.status_code}")
                    print(body[:500])
                    return 1

                for line in resp.iter_lines():
                    if not line or not line.startswith("data:"):
                        continue
                    raw = line[5:].strip()
                    if not raw:
                        continue
                    try:
                        event = json.loads(raw)
                    except json.JSONDecodeError:
                        continue

                    event_count += 1
                    etype = event.get("type")
                    if etype == "RUN_STARTED":
                        saw_run_started = True
                    elif etype == "RUN_FINISHED":
                        saw_run_finished = True
                    elif etype == "RUN_ERROR":
                        saw_run_error = True
                    elif etype == "STATE_DELTA":
                        for op in event.get("delta", []):
                            if op.get("path") == "/factory_result":
                                factory_result = op.get("value")
                            elif op.get("path") == "/factory_error":
                                factory_error = op.get("value")

                    summary = _format_event(event)
                    if summary:
                        print(summary, flush=True)

    except httpx.ConnectError as exc:
        print(f"connection error: {exc}")
        return 2
    except httpx.HTTPError as exc:
        print(f"http error: {exc}")
        return 2

    print("")
    print("=" * 60)
    print("RUN SUMMARY")
    print("=" * 60)
    print(f"  thread_id:  {thread_id}")
    print(f"  run_id:     {run_id}")
    print(f"  events:     {event_count}")
    print(f"  started:    {saw_run_started}")
    print(f"  finished:   {saw_run_finished}")
    print(f"  error:      {saw_run_error}")

    log_dir = LOGS_ROOT / thread_id
    if log_dir.is_dir():
        jsonls = sorted(p.name for p in log_dir.glob("*.jsonl"))
        print(f"  logs:       {log_dir} ({', '.join(jsonls) or 'empty'})")
    else:
        print(f"  logs:       {log_dir} (not created)")

    if factory_result is not None:
        status = factory_result.get("status") if isinstance(factory_result, dict) else "?"
        print(f"  factory:    status={status}")
        snippet = json.dumps(factory_result, default=str)
        if len(snippet) > 400:
            snippet = snippet[:397] + "..."
        print(f"              {snippet}")
    if factory_error:
        print(f"  factory_error: {factory_error}")

    print("=" * 60)
    print("Services remain running. Ctrl-C to stop the stack.")

    if saw_run_error:
        return 1
    if not saw_run_finished:
        print("stream ended before RUN_FINISHED")
        return 1
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--idea", required=True, help="Startup idea prompt")
    args = parser.parse_args()

    thread_id = str(uuid.uuid4())
    run_id = str(uuid.uuid4())

    print(f"idea: {args.idea}")
    print(f"quip: {random.choice(QUIPS)}")
    print(f"thread_id: {thread_id}")
    print(f"logs will be at: {LOGS_ROOT / thread_id}")
    print("waiting for services to come up...")

    if not _wait_for_http_health(ORCHESTRATOR_URL, SERVICE_WAIT_TIMEOUT):
        print(f"orchestrator never became healthy at {ORCHESTRATOR_URL}/health")
        return 2
    print("  orchestrator ok")

    if not _wait_for_http_health(FACTORY_URL, SERVICE_WAIT_TIMEOUT):
        print(f"factory never became healthy at {FACTORY_URL}/health")
        return 2
    print("  factory ok")

    if not _wait_for_tcp(FRONTEND_HOST, FRONTEND_PORT, SERVICE_WAIT_TIMEOUT):
        print(f"frontend never accepted connections on {FRONTEND_HOST}:{FRONTEND_PORT}")
        return 2
    print("  frontend ok")

    print("submitting idea to orchestrator...")
    print("-" * 60)
    return _stream_run(args.idea, thread_id, run_id)


if __name__ == "__main__":
    sys.exit(main())
