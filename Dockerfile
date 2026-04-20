# syntax=docker/dockerfile:1.7
#
# Startup in a Box — all-in-one dev image.
#
# Uses the repo's Makefile for both install and run so container behavior
# matches `make install` / `make demo` on a developer laptop. Requires
# BuildKit (export DOCKER_BUILDKIT=1) for the cache mounts below.
#
#   docker build -t startup-in-a-box .
#   docker run --rm -it \
#       -p 3000:3000 -p 8000:8000 -p 8888:8888 \
#       -v "$PWD/logs:/app/logs" \
#       --env-file orchestrator/.env \
#       --env-file factory/.env \
#       startup-in-a-box
#
# Override the default `make demo` with e.g. `... startup-in-a-box make test`.

# Python 3.11 satisfies orchestrator (>=3.11,<3.12) and factory (>=3.11,<3.13).
FROM python:3.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1 \
    NODE_MAJOR=20 \
    DEBIAN_FRONTEND=noninteractive

# System deps. Cache-mount /var/cache/apt + /var/lib/apt so rebuilds re-use
# downloaded .debs instead of pulling them again. The `rm` of sources.list.d
# cache cleanup is omitted because the cache mounts handle it.
#   make        — runs Makefile targets
#   git         — SDKs that shell out
#   curl/ca/gnupg — fetch NodeSource + GitHub CLI repos
#   tini        — PID-1 signal forwarder (propagates SIGTERM to `make`)
#   gh          — factory devops subagent pushes to GitHub
#   nodejs 20   — frontend (Next.js 16)
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    rm -f /etc/apt/apt.conf.d/docker-clean \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates curl git gnupg make tini \
    && curl -fsSL https://deb.nodesource.com/setup_${NODE_MAJOR}.x | bash - \
    && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
        -o /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
        > /etc/apt/sources.list.d/github-cli.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends nodejs gh

# uv — what the Makefile's Python install targets use.
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

# Vercel CLI is invoked by the factory's devops subagent at runtime. Pinned
# so upstream releases don't bust this layer; bump when you need a newer CLI.
RUN --mount=type=cache,target=/root/.npm \
    npm install -g vercel@44

# rtk — factory's Bash PreToolUse hook (quality_hooks.rtk_rewrite) routes
# commands through `rtk rewrite` for 60-90% token savings. No-op if
# missing, but installing here keeps containerized runs as efficient as
# a `brew install rtk` laptop. Pinned for reproducibility; bump as needed.
ARG RTK_VERSION=0.36.0
RUN ARCH=$(dpkg --print-architecture) \
 && case "$ARCH" in \
      amd64) TRIPLE=x86_64-unknown-linux-musl ;; \
      arm64) TRIPLE=aarch64-unknown-linux-gnu ;; \
      *) echo "rtk: no prebuilt for $ARCH — skipping" && exit 0 ;; \
    esac \
 && curl -fsSL "https://github.com/rtk-ai/rtk/releases/download/v${RTK_VERSION}/rtk-${TRIPLE}.tar.gz" \
      | tar -xz -C /usr/local/bin rtk \
 && chmod +x /usr/local/bin/rtk \
 && rtk --version

WORKDIR /app

# ── Dep install via `make install-*` ─────────────────────────────────────────
# Copy the Makefile and each component's manifest(s) FIRST so the dep layer
# only busts when manifests change — not on every source edit.
COPY Makefile ./
COPY orchestrator/pyproject.toml orchestrator/uv.lock ./orchestrator/
COPY factory/pyproject.toml      factory/uv.lock      ./factory/
COPY frontend/package.json       frontend/package-lock.json ./frontend/

# uv cache → faster rebuilds after a lock change. npm cache does the same.
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=cache,target=/root/.npm \
    make install-orchestrator install-factory install-frontend

# ── Source ───────────────────────────────────────────────────────────────────
COPY . .

# Pre-build the frontend so the first container start isn't blocked on
# `next build`. NODE_OPTIONS caps V8's heap so Turbopack + PixiJS + CopilotKit
# don't balloon past the VM's RAM and trip the OOM killer (exit 137).
RUN --mount=type=cache,target=/root/.npm \
    --mount=type=cache,target=/app/frontend/.next/cache \
    cd frontend && NODE_OPTIONS="--max-old-space-size=4096" npm run build

EXPOSE 3000 8000 8888

# tini as PID 1 forwards SIGTERM to `make` → its shell trap kills all three
# services cleanly on `docker stop` instead of timing out to SIGKILL.
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["make", "demo"]
