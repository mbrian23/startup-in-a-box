#!/usr/bin/env bash
# preflight.sh — Pre-flight checklist for demo readiness.
#
# Exits non-zero on ANY failure. Run before every demo.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FAIL=0

fail() {
    echo "FAIL: $1"
    FAIL=1
}

pass() {
    echo "  OK: $1"
}

echo "=== Pre-flight Checklist ==="
echo ""

# ── .env files exist with required vars ──────────────────────────────────────

echo "--- Environment files ---"

check_env_var() {
    local file="$1"
    local var="$2"
    if [ ! -f "$file" ]; then
        fail "$file does not exist"
        return
    fi
    # Check that the var is set (non-empty value after =)
    if grep -qE "^${var}=.+" "$file" 2>/dev/null; then
        pass "$var is set in $file"
    else
        fail "$var is missing or empty in $file"
    fi
}

if [ -f "$REPO_ROOT/orchestrator/.env" ]; then
    pass "orchestrator/.env exists"
    check_env_var "$REPO_ROOT/orchestrator/.env" "GOOGLE_API_KEY"
else
    fail "orchestrator/.env does not exist (copy from .env.example)"
fi

if [ -f "$REPO_ROOT/factory/.env" ]; then
    pass "factory/.env exists"
    check_env_var "$REPO_ROOT/factory/.env" "ANTHROPIC_API_KEY"
else
    fail "factory/.env does not exist (copy from .env.example)"
fi

echo ""

# ── Node version matches .nvmrc ──────────────────────────────────────────────

echo "--- Node.js ---"

NVMRC_FILE="$REPO_ROOT/frontend/.nvmrc"
if [ -f "$NVMRC_FILE" ]; then
    EXPECTED_NODE=$(cat "$NVMRC_FILE" | tr -d '[:space:]')
    ACTUAL_NODE=$(node --version 2>/dev/null | sed 's/^v//' | cut -d. -f1)
    if [ "$ACTUAL_NODE" = "$EXPECTED_NODE" ]; then
        pass "Node.js major version matches .nvmrc ($EXPECTED_NODE)"
    else
        fail "Node.js version mismatch: expected major $EXPECTED_NODE, got $ACTUAL_NODE"
    fi
else
    fail "frontend/.nvmrc not found"
fi

echo ""

# ── Python version is 3.11 ──────────────────────────────────────────────────

echo "--- Python ---"

PYTHON_VERSION=$(python3 --version 2>/dev/null | awk '{print $2}' | cut -d. -f1,2)
if [ "$PYTHON_VERSION" = "3.11" ]; then
    pass "Python version is 3.11 ($PYTHON_VERSION)"
else
    fail "Python version must be 3.11, got $PYTHON_VERSION"
fi

echo ""

# ── Ports free ───────────────────────────────────────────────────────────────

echo "--- Ports ---"

check_port_free() {
    local port="$1"
    if lsof -ti :"$port" >/dev/null 2>&1; then
        fail "Port $port is in use"
    else
        pass "Port $port is free"
    fi
}

check_port_free 8000
check_port_free 8888
check_port_free 3000

echo ""

# ── Lock files present ──────────────────────────────────────────────────────

echo "--- Lock files ---"

if [ -f "$REPO_ROOT/orchestrator/uv.lock" ]; then
    pass "orchestrator/uv.lock present"
else
    fail "orchestrator/uv.lock missing (run: cd orchestrator && uv sync)"
fi

if [ -f "$REPO_ROOT/factory/uv.lock" ]; then
    pass "factory/uv.lock present"
else
    fail "factory/uv.lock missing (run: cd factory && uv sync)"
fi

if [ -f "$REPO_ROOT/frontend/package-lock.json" ]; then
    pass "frontend/package-lock.json present"
else
    fail "frontend/package-lock.json missing (run: cd frontend && npm install)"
fi

echo ""

# ── Pinned model IDs ────────────────────────────────────────────────────────

echo "--- Pinned Models ---"

# Read from .env or .env.example
ORCH_MODEL=$(grep -E '^ORCHESTRATOR_MODEL=' "$REPO_ROOT/orchestrator/.env" 2>/dev/null | cut -d= -f2 || echo "")
if [ -z "$ORCH_MODEL" ]; then
    ORCH_MODEL="gemini-2.5-pro (default)"
fi
echo "  Orchestrator model: $ORCH_MODEL"

FACTORY_MODEL=$(grep -E '^FACTORY_MODEL=' "$REPO_ROOT/factory/.env" 2>/dev/null | cut -d= -f2 || echo "")
if [ -z "$FACTORY_MODEL" ]; then
    FACTORY_MODEL="claude-sonnet-4-6 (default)"
fi
echo "  Factory model:      $FACTORY_MODEL"

echo ""

# ── Summary ──────────────────────────────────────────────────────────────────

if [ "$FAIL" -ne 0 ]; then
    echo "=== PREFLIGHT FAILED ==="
    echo "Fix the issues above before proceeding."
    exit 1
fi

echo "=== PREFLIGHT PASSED ==="
exit 0
