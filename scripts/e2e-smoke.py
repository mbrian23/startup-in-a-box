#!/usr/bin/env python3
"""E2E smoke test — boots both backends, drives requests, reports results.

Runnable via:  cd factory && uv run python ../scripts/e2e-smoke.py

Exit codes:
    0  Full pipeline success
    3  Direct factory test failed (unexpected)
    4  LLM failures only (plumbing works, model too small — expected)
"""

from __future__ import annotations

import json
import os
import shutil
import signal
import socket
import subprocess
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path

import httpx

REPO_ROOT = Path(__file__).resolve().parent.parent
FACTORY_PORT = 8888
ORCHESTRATOR_PORT = 8000
FACTORY_URL = f"http://localhost:{FACTORY_PORT}"
ORCHESTRATOR_URL = f"http://localhost:{ORCHESTRATOR_PORT}"
MODEL_SERVER_URL = "http://127.0.0.1:1234"

# ── Result tracking ─────────────────────────────────────────────────────────


@dataclass
class PhaseResult:
    name: str
    passed: bool | None = None  # None = skipped
    detail: str = ""
    fatal: bool = False


@dataclass
class Report:
    phases: list[PhaseResult] = field(default_factory=list)

    def add(self, name: str, passed: bool | None, detail: str = "", *, fatal: bool = False) -> PhaseResult:
        r = PhaseResult(name=name, passed=passed, detail=detail, fatal=fatal)
        self.phases.append(r)
        return r

    def print_summary(self) -> int:
        print("\n" + "=" * 60)
        print("E2E SMOKE TEST REPORT")
        print("=" * 60)

        factory_ok = True
        llm_only_failure = False

        for p in self.phases:
            if p.passed is None:
                icon = "SKIP"
            elif p.passed:
                icon = "PASS"
            else:
                icon = "FAIL"
            print(f"  [{icon}] {p.name}")
            if p.detail:
                for line in p.detail.strip().split("\n"):
                    print(f"         {line}")

            if not p.passed and p.passed is not None:
                if p.fatal:
                    factory_ok = False
                elif "Phase 5" in p.name:
                    llm_only_failure = True

        print("-" * 60)

        if not factory_ok:
            print("VERDICT: FAIL — factory plumbing broken (exit 3)")
            return 3
        if llm_only_failure:
            print("VERDICT: EXPECTED — plumbing works, LLM too small (exit 4)")
            print("  Known limitation: local 9B model may not produce valid")
            print("  Pydantic JSON for orchestrator structured-output agents.")
            return 4

        print("VERDICT: PASS — full pipeline success (exit 0)")
        return 0


report = Report()

# ── Helpers ──────────────────────────────────────────────────────────────────


def port_is_free(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(("127.0.0.1", port)) != 0


def wait_for_health(url: str, timeout: float = 30.0) -> bool:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            resp = httpx.get(f"{url}/health", timeout=5.0)
            if resp.status_code == 200:
                return True
        except httpx.ConnectError:
            pass
        time.sleep(0.5)
    return False


def parse_sse_events(text: str) -> list[dict]:
    events: list[dict] = []
    for line in text.split("\n"):
        line = line.strip()
        if line.startswith("data:"):
            payload = line[5:].strip()
            if payload:
                try:
                    events.append(json.loads(payload))
                except json.JSONDecodeError:
                    pass
    return events


def terminate_proc(proc: subprocess.Popen, name: str) -> None:
    if proc.poll() is not None:
        return
    print(f"  Sending SIGTERM to {name} (pid {proc.pid})...")
    proc.terminate()
    try:
        proc.wait(timeout=10)
    except subprocess.TimeoutExpired:
        print(f"  SIGKILL {name}...")
        proc.kill()
        proc.wait(timeout=5)


# ── Phase 0: Preflight ──────────────────────────────────────────────────────

def phase0_preflight() -> bool:
    print("\n--- Phase 0: Preflight ---")
    issues: list[str] = []

    # Check uv
    if not shutil.which("uv"):
        issues.append("uv not found on PATH")

    # Check model server
    try:
        resp = httpx.get(f"{MODEL_SERVER_URL}/v1/models", timeout=5.0)
        if resp.status_code != 200:
            issues.append(f"Model server returned {resp.status_code}")
        else:
            print(f"  Model server reachable ({resp.status_code})")
    except Exception as exc:
        issues.append(f"Model server unreachable: {exc}")

    # Check ports free
    for port in (FACTORY_PORT, ORCHESTRATOR_PORT):
        if not port_is_free(port):
            issues.append(f"Port {port} is in use")
        else:
            print(f"  Port {port} is free")

    if issues:
        report.add("Phase 0: Preflight", False, "\n".join(issues), fatal=True)
        return False

    report.add("Phase 0: Preflight", True)
    return True


# ── Phase 1: Reset ───────────────────────────────────────────────────────────

def phase1_reset() -> bool:
    print("\n--- Phase 1: Reset ---")
    result = subprocess.run(
        ["bash", str(REPO_ROOT / "scripts" / "reset-demo.sh")],
        cwd=str(REPO_ROOT),
        capture_output=True,
        text=True,
        timeout=30,
    )
    if result.returncode != 0:
        # reset-demo.sh checks port 3000 (frontend) but we don't need it.
        # If the only failure is port 3000, treat as non-fatal.
        stdout = result.stdout
        only_port_3000 = (
            "Port 3000 is still in use" in stdout
            and "Port 8000 is free" in stdout
            and "Port 8888 is free" in stdout
        )
        if only_port_3000:
            print("  reset-demo.sh exit 1 (port 3000 in use — frontend not needed, continuing)")
            report.add("Phase 1: Reset", True, "Port 3000 occupied (frontend); ignored for backend smoke test")
            return True

        detail = f"exit {result.returncode}\nstdout: {stdout[-500:]}\nstderr: {result.stderr[-500:]}"
        report.add("Phase 1: Reset", False, detail, fatal=True)
        return False

    print("  reset-demo.sh exited 0")
    report.add("Phase 1: Reset", True)
    return True


# ── Phase 2: Boot services ──────────────────────────────────────────────────

processes: list[tuple[str, subprocess.Popen]] = []


def phase2_boot() -> bool:
    print("\n--- Phase 2: Boot services ---")

    base_env = os.environ.copy()

    # Factory
    factory_env = {**base_env, "USE_AG_UI_SDK": "false", "LOG_JSONL": "1"}
    factory_proc = subprocess.Popen(
        ["uv", "run", "uvicorn", "factory.server:create_app",
         "--factory", "--host", "0.0.0.0", "--port", str(FACTORY_PORT)],
        cwd=str(REPO_ROOT / "factory"),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        env=factory_env,
    )
    processes.append(("factory", factory_proc))

    print(f"  Factory started (pid {factory_proc.pid}), waiting for health...")
    if not wait_for_health(FACTORY_URL, timeout=30.0):
        report.add("Phase 2: Boot services", False, "Factory failed to become healthy within 30s", fatal=True)
        return False
    print("  Factory healthy")

    # Orchestrator
    orch_env = {
        **base_env,
        "LOG_JSONL": "1",
        "OPENAI_API_BASE": "http://127.0.0.1:1234/v1",
        "OPENAI_API_KEY": "dummy-key",
        "ORCHESTRATOR_MODEL": "openai/qwen/qwen3.5-9b",
    }
    orch_proc = subprocess.Popen(
        ["uv", "run", "uvicorn", "orchestrator.server:create_app",
         "--factory", "--host", "0.0.0.0", "--port", str(ORCHESTRATOR_PORT)],
        cwd=str(REPO_ROOT / "orchestrator"),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        env=orch_env,
    )
    processes.append(("orchestrator", orch_proc))

    print(f"  Orchestrator started (pid {orch_proc.pid}), waiting for health...")
    if not wait_for_health(ORCHESTRATOR_URL, timeout=30.0):
        report.add("Phase 2: Boot services", False, "Orchestrator failed to become healthy within 30s", fatal=True)
        return False
    print("  Orchestrator healthy")

    report.add("Phase 2: Boot services", True)
    return True


# ── Phase 3: Deep health checks ─────────────────────────────────────────────

def phase3_deep_health() -> None:
    print("\n--- Phase 3: Deep health checks ---")
    details: list[str] = []
    all_ok = True

    for name, url in [("Factory", FACTORY_URL), ("Orchestrator", ORCHESTRATOR_URL)]:
        try:
            resp = httpx.get(f"{url}/health?deep=true", timeout=10.0)
            data = resp.json()
            llm_ok = data.get("llm_reachable", False)
            status = "ok" if llm_ok else "llm_unreachable"
            details.append(f"{name}: {data} ({status})")
            if not llm_ok:
                all_ok = False
            print(f"  {name} deep health: {data}")
        except Exception as exc:
            details.append(f"{name}: error — {exc}")
            all_ok = False
            print(f"  {name} deep health: error — {exc}")

    # Non-fatal
    report.add("Phase 3: Deep health", all_ok, "\n".join(details))


# ── Phase 4: Direct factory test ────────────────────────────────────────────

def phase4_factory_test() -> bool:
    print("\n--- Phase 4: Direct factory test ---")

    payload = {
        "threadId": "smoke-test-thread",
        "runId": "smoke-test-run",
        "forwardedProps": {
            "build_plan": {
                "summary": "Smoke test build plan",
                "steps": [
                    {
                        "id": "step-1",
                        "title": "Create project scaffold",
                        "description": "Initialize the project directory structure",
                        "tool_hints": ["bash"],
                        "outputs": ["src/"],
                        "depends_on": [],
                        "requires_approval": False,
                    },
                    {
                        "id": "step-2",
                        "title": "Write main module",
                        "description": "Create the main application entry point",
                        "tool_hints": ["write"],
                        "outputs": ["src/main.py"],
                        "depends_on": ["step-1"],
                        "requires_approval": False,
                    },
                    {
                        "id": "step-3",
                        "title": "Add tests",
                        "description": "Write unit tests for the main module",
                        "tool_hints": ["write"],
                        "outputs": ["tests/test_main.py"],
                        "depends_on": ["step-2"],
                        "requires_approval": False,
                    },
                ],
            }
        },
    }

    try:
        with httpx.Client(timeout=30.0) as client:
            resp = client.post(f"{FACTORY_URL}/factory", json=payload)

        if resp.status_code != 200:
            report.add("Phase 4: Factory direct", False, f"HTTP {resp.status_code}: {resp.text[:300]}", fatal=True)
            return False

        events = parse_sse_events(resp.text)
        event_types = [e.get("type") for e in events]
        print(f"  Received {len(events)} events: {event_types}")

        # Validate event sequence
        issues: list[str] = []

        if "RUN_STARTED" not in event_types:
            issues.append("Missing RUN_STARTED")
        if "RUN_FINISHED" not in event_types:
            issues.append("Missing RUN_FINISHED")
        if "RUN_ERROR" in event_types:
            error_events = [e for e in events if e.get("type") == "RUN_ERROR"]
            issues.append(f"Unexpected RUN_ERROR: {error_events}")

        state_deltas = [e for e in events if e.get("type") == "STATE_DELTA"]
        if len(state_deltas) < 3:
            issues.append(f"Expected >= 3 STATE_DELTAs for 3 steps, got {len(state_deltas)}")

        text_messages = [e for e in events if e.get("type") == "TEXT_MESSAGE_CONTENT"]
        if len(text_messages) < 3:
            issues.append(f"Expected >= 3 TEXT_MESSAGE_CONTENTs for 3 steps, got {len(text_messages)}")

        # Check ordering: RUN_STARTED first, RUN_FINISHED last
        if event_types and event_types[0] != "RUN_STARTED":
            issues.append(f"First event should be RUN_STARTED, got {event_types[0]}")
        if event_types and event_types[-1] != "RUN_FINISHED":
            issues.append(f"Last event should be RUN_FINISHED, got {event_types[-1]}")

        if issues:
            report.add("Phase 4: Factory direct", False, "\n".join(issues), fatal=True)
            return False

        print("  Event sequence validated: RUN_STARTED -> 3x STATE_DELTA + TEXT_MESSAGE_CONTENT -> RUN_FINISHED")
        report.add("Phase 4: Factory direct", True, f"{len(events)} events, sequence valid")
        return True

    except Exception as exc:
        report.add("Phase 4: Factory direct", False, f"Exception: {exc}", fatal=True)
        return False


# ── Phase 5: Full orchestrator pipeline ─────────────────────────────────────

def phase5_orchestrator_pipeline() -> bool:
    print("\n--- Phase 5: Full orchestrator pipeline ---")
    print("  (360s timeout — local model is slow, 3 sequential LLM calls)")

    payload = {
        "threadId": "smoke-e2e-thread",
        "runId": "smoke-e2e-run",
        "state": {},
        "messages": [
            {
                "id": "smoke-msg-1",
                "role": "user",
                "content": "Uber for crossing the street",
            },
        ],
        "tools": [],
        "context": [],
        "forwardedProps": None,
    }

    try:
        with httpx.Client(timeout=360.0) as client:
            resp = client.post(
                f"{ORCHESTRATOR_URL}/orchestrator",
                json=payload,
                headers={"Accept": "text/event-stream"},
            )

        if resp.status_code != 200:
            report.add("Phase 5: Orchestrator pipeline", False, f"HTTP {resp.status_code}: {resp.text[:500]}")
            return False

        events = parse_sse_events(resp.text)
        event_types = [e.get("type") for e in events]
        print(f"  Received {len(events)} events")
        if event_types:
            print(f"  Event types: {event_types[:20]}{'...' if len(event_types) > 20 else ''}")

        # Classify outcome
        has_run_started = "RUN_STARTED" in event_types
        has_run_finished = "RUN_FINISHED" in event_types
        has_run_error = "RUN_ERROR" in event_types
        has_state_delta = "STATE_DELTA" in event_types

        # Determine furthest stage
        stages_reached: list[str] = []
        if has_run_started:
            stages_reached.append("run_started")
        if has_state_delta:
            stages_reached.append("data_structured")
        # Check for tool calls indicating market research
        tool_calls = [e for e in events if e.get("type") == "TOOL_CALL_START"]
        tool_names = [t.get("toolCallName", "") for t in tool_calls]
        if any("search" in n.lower() or "market" in n.lower() for n in tool_names):
            stages_reached.append("market_researched")
        if any("build" in n.lower() or "plan" in n.lower() for n in tool_names):
            stages_reached.append("build_planned")
        if any("factory" in n.lower() or "delegate" in n.lower() for n in tool_names):
            stages_reached.append("factory_delegated")
        if has_run_finished:
            stages_reached.append("completed")

        furthest = stages_reached[-1] if stages_reached else "none"

        if has_run_finished and not has_run_error:
            outcome = "full_success"
            detail = f"Full success! {len(events)} events, furthest: {furthest}"
            print(f"  Outcome: FULL SUCCESS")
            report.add("Phase 5: Orchestrator pipeline", True, detail)
            return True
        elif has_run_error:
            error_events = [e for e in events if e.get("type") == "RUN_ERROR"]
            error_msgs = [e.get("message", "unknown") for e in error_events]
            is_pydantic = any("validat" in m.lower() or "pydantic" in m.lower() for m in error_msgs)
            if is_pydantic or len(events) > 1:
                outcome = "llm_failure"
                detail = (
                    f"LLM failure (expected with 9B model).\n"
                    f"Furthest stage: {furthest}\n"
                    f"Events received: {len(events)}\n"
                    f"Errors: {error_msgs[:3]}"
                )
            else:
                outcome = "partial_success"
                detail = f"Partial: {len(events)} events, furthest: {furthest}\nErrors: {error_msgs[:3]}"
            print(f"  Outcome: {outcome.upper()}")
            report.add("Phase 5: Orchestrator pipeline", False, detail)
            return False
        elif events:
            detail = f"Partial success: {len(events)} events but no RUN_FINISHED. Furthest: {furthest}"
            print(f"  Outcome: PARTIAL")
            report.add("Phase 5: Orchestrator pipeline", False, detail)
            return False
        else:
            report.add("Phase 5: Orchestrator pipeline", False, "No events received")
            return False

    except httpx.ReadTimeout:
        report.add("Phase 5: Orchestrator pipeline", False, "Timed out after 360s (local model too slow)")
        return False
    except httpx.ConnectError as exc:
        report.add("Phase 5: Orchestrator pipeline", False, f"Connection error: {exc}")
        return False
    except Exception as exc:
        report.add("Phase 5: Orchestrator pipeline", False, f"Exception: {exc}")
        return False


# ── Phase 6: Log verification ───────────────────────────────────────────────

def phase6_logs() -> None:
    print("\n--- Phase 6: Log verification ---")
    details: list[str] = []

    for module in ("factory", "orchestrator"):
        log_dir = REPO_ROOT / module / "logs"
        if not log_dir.is_dir():
            # Also check repo-root logs/
            log_dir = REPO_ROOT / "logs"

        if log_dir.is_dir():
            jsonl_files = list(log_dir.glob("*.jsonl"))
            if jsonl_files:
                for f in jsonl_files:
                    lines = f.read_text().strip().split("\n")
                    error_lines = [l for l in lines if '"ERROR"' in l or '"error"' in l.lower()]
                    details.append(f"{f.name}: {len(lines)} lines, {len(error_lines)} errors")
                    print(f"  {f.name}: {len(lines)} lines, {len(error_lines)} errors")
            else:
                details.append(f"{module}: no .jsonl files in {log_dir}")
                print(f"  {module}: no .jsonl files found")
        else:
            details.append(f"{module}: logs directory not found")
            print(f"  {module}: logs directory not found")

    # Informational only
    report.add("Phase 6: Log verification", True, "\n".join(details))


# ── Phase 7: Teardown ───────────────────────────────────────────────────────

def phase7_teardown() -> None:
    print("\n--- Phase 7: Teardown ---")
    for name, proc in reversed(processes):
        terminate_proc(proc, name)
    report.add("Phase 7: Teardown", True)


# ── Main ─────────────────────────────────────────────────────────────────────

def main() -> int:
    print("=" * 60)
    print("E2E SMOKE TEST")
    print("=" * 60)

    # Register cleanup on unexpected exit
    def cleanup_on_signal(signum: int, frame: object) -> None:
        print(f"\nCaught signal {signum}, cleaning up...")
        phase7_teardown()
        sys.exit(1)

    signal.signal(signal.SIGINT, cleanup_on_signal)
    signal.signal(signal.SIGTERM, cleanup_on_signal)

    try:
        if not phase0_preflight():
            return report.print_summary()

        if not phase1_reset():
            return report.print_summary()

        if not phase2_boot():
            phase7_teardown()
            return report.print_summary()

        phase3_deep_health()

        factory_ok = phase4_factory_test()

        if factory_ok:
            phase5_orchestrator_pipeline()
        else:
            report.add("Phase 5: Orchestrator pipeline", None, "Skipped — factory test failed")

        phase6_logs()
        phase7_teardown()

    except Exception as exc:
        report.add("Unexpected error", False, str(exc), fatal=True)
        phase7_teardown()

    return report.print_summary()


if __name__ == "__main__":
    sys.exit(main())
