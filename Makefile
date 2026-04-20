.DEFAULT_GOAL := help

ORCHESTRATOR := orchestrator
FACTORY      := factory
FRONTEND     := frontend
DECK         := web

.PHONY: help install install-orchestrator install-factory install-frontend install-deck \
        dev dev-auto dev-cheap demo demo-gemini dev-orchestrator dev-factory dev-frontend dev-deck kill-ports \
        open-urls open-deck \
        adk-web test test-orchestrator test-factory \
        lint preflight reset clean docker docker-build docker-run \
        compose-demo compose-down compose-logs

DEV_PORTS := 8000 8888 3000 7833

help:
	@awk 'BEGIN {FS = ":.*##"; printf "\nTargets:\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

# ── install ──────────────────────────────────────────────────────────────────

install: install-orchestrator install-factory install-frontend install-deck ## Install all deps

install-orchestrator: ## uv sync orchestrator
	cd $(ORCHESTRATOR) && uv sync --extra dev

install-factory: ## uv sync factory
	cd $(FACTORY) && uv sync --extra dev

install-frontend: ## npm install frontend
	cd $(FRONTEND) && npm install

install-deck: ## npm install + snapshot web deck
	cd $(DECK) && npm install && npm run snapshot

# ── dev servers ──────────────────────────────────────────────────────────────

open-urls: ## Open http://localhost:3000 (app) + :7833 (deck) after a short boot delay. Set NO_OPEN=1 to skip.
	@if [ -n "$$NO_OPEN" ]; then exit 0; fi; \
	sleep 5; \
	if command -v open >/dev/null 2>&1; then \
	  open http://localhost:3000 http://localhost:7833 2>/dev/null || true; \
	elif command -v xdg-open >/dev/null 2>&1; then \
	  xdg-open http://localhost:3000 >/dev/null 2>&1 || true; \
	  xdg-open http://localhost:7833 >/dev/null 2>&1 || true; \
	else \
	  echo "(open-urls: no 'open' or 'xdg-open' found — visit http://localhost:3000 and http://localhost:7833)"; \
	fi

open-deck: ## Open just http://localhost:7833 (deck only)
	@if [ -n "$$NO_OPEN" ]; then exit 0; fi; \
	sleep 4; \
	if command -v open >/dev/null 2>&1; then open http://localhost:7833 2>/dev/null || true; \
	elif command -v xdg-open >/dev/null 2>&1; then xdg-open http://localhost:7833 >/dev/null 2>&1 || true; \
	fi

kill-ports: ## Kill any process bound to dev ports (8000, 8888, 3000, 7833) — skips Colima SSH forwarders
	@for port in $(DEV_PORTS); do \
		pids=$$(lsof -ti tcp:$$port 2>/dev/null || true); \
		if [ -n "$$pids" ]; then \
			safe=""; \
			for p in $$pids; do \
				cmd=$$(ps -o command= -p $$p 2>/dev/null || true); \
				case "$$cmd" in *colima*|*lima*) ;; *) safe="$$safe $$p" ;; esac; \
			done; \
			if [ -n "$$safe" ]; then \
				echo "Killing PID(s) on :$$port →$$safe"; \
				kill -9 $$safe 2>/dev/null || true; \
			fi; \
		fi; \
	done

dev: kill-ports ## Run orchestrator + factory + frontend + deck concurrently (Ctrl-C to stop all)
	@echo "Starting orchestrator (:8000), factory (:8888), frontend (:3000), deck (:7833)…"
	@trap 'trap - INT TERM EXIT; echo; echo "Stopping…"; kill 0' INT TERM EXIT; \
	( cd $(ORCHESTRATOR) && uv run uvicorn orchestrator.server:create_app --factory --reload --host 0.0.0.0 --port 8000 2>&1 | sed -u "s/^/[orch]    /" ) & \
	( cd $(FACTORY)      && uv run uvicorn factory.server:create_app      --factory --reload --reload-dir src --host 0.0.0.0 --port 8888 2>&1 | sed -u "s/^/[factory] /" ) & \
	( cd $(FRONTEND)     && npm run dev                                                   2>&1 | sed -u "s/^/[web]     /" ) & \
	( cd $(DECK)         && npm run dev                                                   2>&1 | sed -u "s/^/[deck]    /" ) & \
	( $(MAKE) -s open-urls 2>&1 | sed -u "s/^/[open]    /" ) & \
	wait

dev-auto: kill-ports ## Run dev stack and auto-submit IDEA="..." once services are healthy
	@if [ -z "$(IDEA)" ]; then echo 'Usage: make dev-auto IDEA="your startup idea"'; exit 2; fi
	@echo "Starting orchestrator (:8000), factory (:8888), frontend (:3000), deck (:7833)…"
	@echo "Will auto-submit idea: $(IDEA)"
	@trap 'trap - INT TERM EXIT; echo; echo "Stopping…"; kill 0' INT TERM EXIT; \
	( cd $(ORCHESTRATOR) && uv run uvicorn orchestrator.server:create_app --factory --reload --host 0.0.0.0 --port 8000 2>&1 | sed -u "s/^/[orch]    /" ) & \
	( cd $(FACTORY)      && uv run uvicorn factory.server:create_app      --factory --reload --reload-dir src --host 0.0.0.0 --port 8888 2>&1 | sed -u "s/^/[factory] /" ) & \
	( cd $(FRONTEND)     && npm run dev                                                   2>&1 | sed -u "s/^/[web]     /" ) & \
	( cd $(DECK)         && npm run dev                                                   2>&1 | sed -u "s/^/[deck]    /" ) & \
	( cd $(ORCHESTRATOR) && uv run python ../scripts/dev-auto.py --idea "$(IDEA)"         2>&1 | sed -u "s/^/[auto]    /" ) & \
	( $(MAKE) -s open-urls 2>&1 | sed -u "s/^/[open]    /" ) & \
	wait

demo: kill-ports ## Demo mode — production build, no hot reload. Models come from env (.env or --env-file). Optional IDEA=... auto-submits.
	@echo "DEMO mode — built artifacts only (no hot reload)"
	@echo "  orchestrator/factory: uvicorn (no --reload)"
	@echo "  frontend: next build → next start"
	@echo "Building frontend + deck (must succeed before servers start)…"
	@cd $(FRONTEND) && npm run build
	@cd $(DECK) && npm run snapshot && npm run build
	@echo "Builds OK."
	@if [ -n "$(IDEA)" ]; then echo "Auto-submitting idea: $(IDEA)"; else echo "Open http://localhost:3000 (app) or http://localhost:7833 (deck)."; fi
	@trap 'trap - INT TERM EXIT; echo; echo "Stopping…"; kill 0' INT TERM EXIT; \
	( cd $(ORCHESTRATOR) && uv run uvicorn orchestrator.server:create_app --factory --host 0.0.0.0 --port 8000 2>&1 | sed -u "s/^/[orch]    /" ) & \
	( cd $(FACTORY)      && uv run uvicorn factory.server:create_app      --factory --host 0.0.0.0 --port 8888 2>&1 | sed -u "s/^/[factory] /" ) & \
	( cd $(FRONTEND)     && npm run start -- --port 3000                                  2>&1 | sed -u "s/^/[web]     /" ) & \
	( cd $(DECK)         && npm run start                                                 2>&1 | sed -u "s/^/[deck]    /" ) & \
	( $(MAKE) -s open-urls 2>&1 | sed -u "s/^/[open]    /" ) & \
	if [ -n "$(IDEA)" ]; then \
	  ( cd $(ORCHESTRATOR) && uv run python ../scripts/dev-auto.py --idea "$(IDEA)"       2>&1 | sed -u "s/^/[auto]    /" ) & \
	fi; \
	wait

demo-offline: kill-ports ## Offline demo — frontend only, no API keys, no backend. Replays a recorded run at 4× speed.
	@echo "OFFLINE DEMO — frontend only, replaying pre-recorded run"
	@echo "Open http://localhost:3000/?demo to watch the replay"
	@trap 'trap - INT TERM EXIT; echo; echo "Stopping…"; kill 0' INT TERM EXIT; \
	( cd $(FRONTEND) && npm run dev 2>&1 | sed -u "s/^/[web]     /" ) & \
	sleep 4; \
	if command -v open >/dev/null 2>&1; then open "http://localhost:3000/?demo" 2>/dev/null || true; \
	elif command -v xdg-open >/dev/null 2>&1; then xdg-open "http://localhost:3000/?demo" >/dev/null 2>&1 || true; \
	fi; \
	wait

demo-gemini: kill-ports ## Override `make demo` with google-genai native for orchestrator/ceo/cto (burns the 250/day free-tier quota on pro-preview). Factory model still comes from factory/.env.
	@echo "DEMO mode (gemini-native) — google-genai transport, no OpenRouter"
	@cd $(FRONTEND) && npm run build
	@cd $(DECK) && npm run snapshot && npm run build
	@if [ -n "$(IDEA)" ]; then echo "Auto-submitting idea: $(IDEA)"; else echo "Open http://localhost:3000 (app) or http://localhost:7833 (deck)."; fi
	@trap 'trap - INT TERM EXIT; echo; echo "Stopping…"; kill 0' INT TERM EXIT; \
	( cd $(ORCHESTRATOR) && \
	    ORCHESTRATOR_MODEL=gemini-3-flash-preview \
	    CEO_MODEL=gemini-3-flash-preview \
	    CTO_MODEL=gemini-3.1-pro-preview \
	    uv run uvicorn orchestrator.server:create_app --factory --host 0.0.0.0 --port 8000 2>&1 | sed -u "s/^/[orch]    /" ) & \
	( cd $(FACTORY)      && uv run uvicorn factory.server:create_app      --factory --host 0.0.0.0 --port 8888 2>&1 | sed -u "s/^/[factory] /" ) & \
	( cd $(FRONTEND)     && npm run start -- --port 3000                                  2>&1 | sed -u "s/^/[web]     /" ) & \
	( cd $(DECK)         && npm run start                                                 2>&1 | sed -u "s/^/[deck]    /" ) & \
	( $(MAKE) -s open-urls 2>&1 | sed -u "s/^/[open]    /" ) & \
	if [ -n "$(IDEA)" ]; then \
	  ( cd $(ORCHESTRATOR) && uv run python ../scripts/dev-auto.py --idea "$(IDEA)"       2>&1 | sed -u "s/^/[auto]    /" ) & \
	fi; \
	wait

dev-cheap: kill-ports ## Run dev stack with flash-lite + haiku everywhere. Optional IDEA=... auto-submits.
	@echo "CHEAP-DEV mode — flash-lite orchestrator, haiku factory + subagents"
	@if [ -n "$(IDEA)" ]; then echo "Auto-submitting idea: $(IDEA)"; fi
	@trap 'trap - INT TERM EXIT; echo; echo "Stopping…"; kill 0' INT TERM EXIT; \
	( cd $(ORCHESTRATOR) && \
	    ORCHESTRATOR_MODEL=gemini-3.1-flash-lite-preview CEO_MODEL=gemini-3.1-flash-lite-preview CTO_MODEL=gemini-3.1-flash-lite-preview \
	    uv run uvicorn orchestrator.server:create_app --factory --reload --host 0.0.0.0 --port 8000 2>&1 | sed -u "s/^/[orch]    /" ) & \
	( cd $(FACTORY)      && \
	    FACTORY_MODEL=anthropic/claude-haiku-4.5 SUBAGENT_MODEL=haiku \
	    uv run uvicorn factory.server:create_app      --factory --reload --reload-dir src --host 0.0.0.0 --port 8888 2>&1 | sed -u "s/^/[factory] /" ) & \
	( cd $(FRONTEND)     && npm run dev                                                   2>&1 | sed -u "s/^/[web]     /" ) & \
	( cd $(DECK)         && npm run dev                                                   2>&1 | sed -u "s/^/[deck]    /" ) & \
	( $(MAKE) -s open-urls 2>&1 | sed -u "s/^/[open]    /" ) & \
	if [ -n "$(IDEA)" ]; then \
	  ( cd $(ORCHESTRATOR) && uv run python ../scripts/dev-auto.py --idea "$(IDEA)"       2>&1 | sed -u "s/^/[auto]    /" ) & \
	fi; \
	wait

dev-orchestrator: ## Run orchestrator FastAPI server
	cd $(ORCHESTRATOR) && uv run uvicorn orchestrator.server:create_app --factory --reload --host 0.0.0.0 --port 8000

dev-factory: ## Run factory FastAPI server
	cd $(FACTORY) && uv run uvicorn factory.server:create_app --factory --reload --reload-dir src --host 0.0.0.0 --port 8888

dev-frontend: ## Run Next.js dev server
	cd $(FRONTEND) && npm run dev

dev-deck: kill-ports ## Run only the web-edition deck (:7833) and open the browser
	@trap 'trap - INT TERM EXIT; echo; echo "Stopping…"; kill 0' INT TERM EXIT; \
	( cd $(DECK) && npm run dev 2>&1 | sed -u "s/^/[deck]    /" ) & \
	( $(MAKE) -s open-deck 2>&1 | sed -u "s/^/[open]    /" ) & \
	wait

adk-web: ## Launch ADK dev UI for raw event inspection
	cd $(ORCHESTRATOR) && uv run adk web ./adk_apps

# ── tests ────────────────────────────────────────────────────────────────────

test: test-orchestrator test-factory test-frontend ## Run every test suite

test-orchestrator: ## pytest orchestrator
	cd $(ORCHESTRATOR) && uv run pytest

test-factory: ## pytest factory
	cd $(FACTORY) && uv run pytest

test-frontend: ## vitest frontend
	cd $(FRONTEND) && npm test

lint: ## eslint frontend
	cd $(FRONTEND) && npm run lint

# ── ops ──────────────────────────────────────────────────────────────────────

preflight: ## Demo readiness checks
	./scripts/preflight.sh

reset: ## Reset demo state
	./scripts/reset-demo.sh

clean: ## Remove caches and build artifacts
	find . -type d \( -name __pycache__ -o -name .pytest_cache -o -name .ruff_cache \) -prune -exec rm -rf {} +
	rm -rf $(FRONTEND)/.next $(FRONTEND)/node_modules/.cache

# ── docker ───────────────────────────────────────────────────────────────────

DOCKER_IMAGE := startup-in-a-box
DOCKER_ENV_FILES := $(foreach f,orchestrator/.env factory/.env,$(if $(wildcard $(f)),--env-file $(f)))

docker-build: ## Build the all-in-one container image
	docker build -t $(DOCKER_IMAGE) .

docker-run: ## Run the container (auto-mounts orchestrator/.env + factory/.env + logs/ if present)
	mkdir -p logs
	docker run --rm -it -p 3000:3000 -p 8000:8000 -p 8888:8888 -v "$$PWD/logs:/app/logs" $(DOCKER_ENV_FILES) $(DOCKER_IMAGE)

docker: docker-build docker-run ## Build then run the container in one go

# ── compose (demo) ───────────────────────────────────────────────────────────
# Split demo stack: one image per service, remappable host ports via .env
# (see .env.docker.example). `make dev` is unchanged — this is demo only.

COMPOSE_FILES := -f docker-compose.yml $(if $(filter 1,$(CHEAP)),-f docker-compose.cheap.yml)

compose-demo: kill-ports ## Build & run the three-service demo stack + native deck on :7833 (next build → next start). Pass CHEAP=1 to pin every model to haiku/flash-lite via the existing .env.dev overlays.
	@mkdir -p logs factory/workspace
	@if [ "$(CHEAP)" = "1" ]; then echo "CHEAP=1 — layering docker-compose.cheap.yml (flash-lite + haiku everywhere)"; fi
	@echo "Wiping deck .next/ so the next start serves a clean build (prior dev-mode cache causes RSC runtime errors)…"
	@rm -rf $(DECK)/.next
	@echo "Building deck (next build must succeed before servers start)…"
	@cd $(DECK) && npm run snapshot && npm run build
	@echo "compose stack (containers) + deck on :7833 (next start) — Ctrl-C stops both"
	@trap 'echo; echo "Stopping…"; kill 0 2>/dev/null; docker compose $(COMPOSE_FILES) down 2>/dev/null; exit 0' INT TERM EXIT; \
	( cd $(DECK) && npm run start 2>&1 | sed -u "s/^/[deck]    /" ) & \
	( $(MAKE) -s open-urls 2>&1 | sed -u "s/^/[open]    /" ) & \
	docker compose $(COMPOSE_FILES) up --build 2>&1 | sed -u "s/^/[compose] /"

compose-down: ## Stop and remove the demo stack
	docker compose $(COMPOSE_FILES) down

compose-logs: ## Tail logs from all three demo services
	docker compose $(COMPOSE_FILES) logs -f
