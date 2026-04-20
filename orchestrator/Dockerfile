# syntax=docker/dockerfile:1.7
#
# Orchestrator service image (Google ADK + ag-ui-adk, FastAPI).
#
# Layout mirrors the repo (`/repo/orchestrator/...`) so the `parents[3]`
# lookup in logging_config.py resolves to `/repo`, matching the native
# dev layout.

FROM python:3.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1 \
    DEBIAN_FRONTEND=noninteractive

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    rm -f /etc/apt/apt.conf.d/docker-clean \
 && apt-get update \
 && apt-get install -y --no-install-recommends \
      ca-certificates curl git tini

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

WORKDIR /repo/orchestrator

COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --extra dev --no-install-project

COPY src ./src
COPY adk_apps ./adk_apps

RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --extra dev

EXPOSE 8000
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["uv", "run", "uvicorn", "orchestrator.server:create_app", \
     "--factory", "--host", "0.0.0.0", "--port", "8000"]
