#!/usr/bin/env bash
# reset-demo.sh — Idempotent demo environment reset.
#
# Kills backend uvicorn processes on ports 8000 and 8888,
# removes factory session/workspace state, clears logs,
# and verifies required ports are free.
#
# Does NOT kill the Vite dev server (port 3000).
# Running twice produces the same end state as running once.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# ── Kill uvicorn on backend ports ────────────────────────────────────────────

kill_port() {
    local port="$1"
    local pids
    pids=$(lsof -ti :"$port" 2>/dev/null || true)
    if [ -n "$pids" ]; then
        echo "Killing processes on port $port: $pids"
        echo "$pids" | xargs kill -9 2>/dev/null || true
        sleep 0.5
    fi
}

kill_port 8000
kill_port 8888

# ── Remove factory session and workspace state ───────────────────────────────

if [ -d "$REPO_ROOT/factory/.claude" ]; then
    echo "Removing factory/.claude/"
    rm -rf "$REPO_ROOT/factory/.claude"
fi

if [ -d "$REPO_ROOT/factory/workspace" ]; then
    echo "Removing factory/workspace/"
    rm -rf "$REPO_ROOT/factory/workspace"
fi

# ── Remove stale .pid files ──────────────────────────────────────────────────

find "$REPO_ROOT" -maxdepth 2 -name '*.pid' -type f -delete 2>/dev/null || true

# ── Clear forensic logs ──────────────────────────────────────────────────────

if [ -d "$REPO_ROOT/logs" ]; then
    rm -f "$REPO_ROOT/logs"/*.jsonl 2>/dev/null || true
    echo "Cleared logs/"
fi

# ── Verify ports are free ────────────────────────────────────────────────────

check_port_free() {
    local port="$1"
    if lsof -ti :"$port" >/dev/null 2>&1; then
        echo "ERROR: Port $port is still in use after cleanup."
        lsof -i :"$port" 2>/dev/null || true
        return 1
    fi
    echo "Port $port is free."
}

exit_code=0
check_port_free 8000 || exit_code=1
check_port_free 8888 || exit_code=1
check_port_free 3000 || exit_code=1

if [ "$exit_code" -ne 0 ]; then
    echo ""
    echo "FAIL: One or more required ports are occupied."
    exit 1
fi

echo ""
echo "Demo environment reset complete."
