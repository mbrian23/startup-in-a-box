# syntax=docker/dockerfile:1.7
#
# Software Factory service image.
#
# Python 3.11 (factory requires <3.13) + Node 20 — the Claude Agent SDK
# spawns the `claude` Node CLI at runtime, so Node has to be on $PATH.
# Layout mirrors the repo (`/repo/factory/...`) so `Path(__file__).parents[3]`
# in settings.py and logging_config.py resolves to `/repo`, which is where
# logs and the caveman plugin are expected to live.

FROM python:3.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1 \
    NODE_MAJOR=20 \
    DEBIAN_FRONTEND=noninteractive

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    rm -f /etc/apt/apt.conf.d/docker-clean \
 && apt-get update \
 && apt-get install -y --no-install-recommends \
      ca-certificates curl git gnupg tini \
 && curl -fsSL https://deb.nodesource.com/setup_${NODE_MAJOR}.x | bash - \
 && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
      -o /usr/share/keyrings/githubcli-archive-keyring.gpg \
 && chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
 && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
      > /etc/apt/sources.list.d/github-cli.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends nodejs gh

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

# Vercel CLI — devops subagent runs `vercel --prod --yes --token ...`.
RUN --mount=type=cache,target=/root/.npm \
    npm install -g vercel@44

WORKDIR /repo/factory

COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --extra dev --no-install-project

COPY src ./src
COPY skills ./skills
COPY vendor ./vendor

RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --extra dev

# rtk — factory's Bash PreToolUse hook routes commands through
# `rtk rewrite` for 60-90% token savings. No-op if missing; hook just
# logs a warning and passes the command through. Placed last so the
# rest of the image layer cache survives a rebuild.
#
# The install MUST NOT fail the build: rtk is an optimization, not a
# dependency. On arm64 the `-gnu` build links against glibc 2.39
# (Debian trixie+); bookworm ships 2.36, so we prefer musl (static,
# libc-independent) when it exists and fall back silently otherwise.
ARG RTK_VERSION=0.36.0
RUN set -e; \
    ARCH=$(dpkg --print-architecture); \
    case "$ARCH" in \
      amd64) CANDIDATES="x86_64-unknown-linux-musl" ;; \
      arm64) CANDIDATES="aarch64-unknown-linux-musl aarch64-unknown-linux-gnu" ;; \
      *)     CANDIDATES="" ;; \
    esac; \
    for TRIPLE in $CANDIDATES; do \
      URL="https://github.com/rtk-ai/rtk/releases/download/v${RTK_VERSION}/rtk-${TRIPLE}.tar.gz"; \
      echo "rtk: trying $TRIPLE"; \
      if curl -fsSL "$URL" | tar -xz -C /usr/local/bin rtk 2>/dev/null \
         && chmod +x /usr/local/bin/rtk \
         && /usr/local/bin/rtk --version 2>/dev/null; then \
        echo "rtk: installed $TRIPLE"; exit 0; \
      fi; \
      rm -f /usr/local/bin/rtk; \
    done; \
    echo "rtk: no compatible prebuilt for $ARCH on this libc — hook will no-op"; \
    exit 0

EXPOSE 8888
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["uv", "run", "uvicorn", "factory.server:create_app", \
     "--factory", "--host", "0.0.0.0", "--port", "8888"]
