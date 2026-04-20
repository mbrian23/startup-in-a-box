# syntax=docker/dockerfile:1.7
#
# Frontend service image (Next.js 16 — production build, demo mode).
#
# `NEXT_PUBLIC_FACTORY_URL` is inlined at build time by Next.js, so
# changes to the host factory port require a rebuild. Compose passes
# it in via `build.args` so the browser-facing URL tracks the host
# port mapping.

FROM node:20-bookworm-slim AS build

ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci

COPY . .

# Browser-facing URL for the factory SSE stream — must point at the host
# port the compose file publishes, not the internal docker network.
ARG NEXT_PUBLIC_FACTORY_URL=http://localhost:8888
ENV NEXT_PUBLIC_FACTORY_URL=$NEXT_PUBLIC_FACTORY_URL

# 4 GB heap cap keeps Turbopack + PixiJS + CopilotKit from OOM-killing
# the build. Matches the cap in the monolithic Dockerfile.
RUN --mount=type=cache,target=/root/.npm \
    --mount=type=cache,target=/app/.next/cache \
    NODE_OPTIONS="--max-old-space-size=4096" npm run build

# ── runtime ──────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

RUN apt-get update && apt-get install -y --no-install-recommends tini \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=build /app ./

EXPOSE 3000
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["npm", "run", "start", "--", "-H", "0.0.0.0", "-p", "3000"]
