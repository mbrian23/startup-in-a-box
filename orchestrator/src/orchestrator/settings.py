"""Orchestrator settings.

All runtime configuration is injected through this class. Nothing downstream
may hardcode a port, a CORS origin, an API key, or the factory URL — Task 9's
demo playbook depends on every knob being environment-addressable.
"""

from __future__ import annotations

import os

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Environment-driven orchestrator configuration.

    Defaults are chosen so the scaffold boots standalone for the test suite.
    Task 9's runbook overrides these via the shared `.env` files.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    port: int = 8000
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000"])
    google_api_key: str = ""
    openrouter_api_key: str = ""
    factory_url: str = "http://localhost:8888/factory"
    log_jsonl: bool = True
    # Default transport: OpenRouter. Flipping a single env var swaps the
    # whole stack back to google-genai native — e.g.
    # ``ORCHESTRATOR_MODEL=gemini-3-flash-preview CEO_MODEL=... CTO_MODEL=...``
    # — without touching any agent code. The ``openrouter/<provider>/<model>``
    # prefix is what ``_model.build_model`` uses to pick the transport.
    orchestrator_model: str = "openrouter/google/gemini-2.5-flash"
    ceo_model: str = "openrouter/google/gemini-2.5-flash"
    cto_model: str = "openrouter/google/gemini-2.5-pro"
    api_base_url: str = "http://127.0.0.1:1234"
    handoff_beat1_duration_seconds: float = 1.5
    factory_idle_timeout_seconds: int = 14400
    hitl_timeout_seconds: int = 259200  # 3 days — gate stays open indefinitely in practice
    openai_api_key: str = "dummy-key"
    openai_api_base: str = "http://127.0.0.1:1234/v1"

    @model_validator(mode="after")
    def _export_provider_env(self) -> Settings:
        """Export provider env vars so downstream SDKs pick them up.

        Gemini models in ADK use google-genai, which reads ``GOOGLE_API_KEY``
        from the environment. LiteLLM-routed models (``openai/...``) read
        ``OPENAI_API_KEY`` / ``OPENAI_API_BASE`` from the environment. We
        load everything through pydantic-settings and then mirror it onto
        ``os.environ`` so the underlying SDKs can find it.

        Only override if missing/empty — respect externally-set credentials.
        """
        if self.google_api_key and not os.environ.get("GOOGLE_API_KEY"):
            os.environ["GOOGLE_API_KEY"] = self.google_api_key
        # LiteLLM reads OPENROUTER_API_KEY from the env when a model name
        # starts with ``openrouter/``. Export here so `.env` is the only
        # place a key ever has to be written.
        if self.openrouter_api_key and not os.environ.get("OPENROUTER_API_KEY"):
            os.environ["OPENROUTER_API_KEY"] = self.openrouter_api_key
        if not os.environ.get("OPENAI_API_KEY"):
            os.environ["OPENAI_API_KEY"] = self.openai_api_key
        if not os.environ.get("OPENAI_API_BASE"):
            os.environ["OPENAI_API_BASE"] = self.openai_api_base
        return self

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_csv(cls, value: object) -> object:
        """Accept comma-separated env strings as well as native lists."""
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    def validate_timeout_invariant(self) -> None:
        """Enforce coupled-knob invariant at boot.

        factory_idle_timeout_seconds must be at least 720 (12 min) so the
        factory SSE stream doesn't time out during long Claude SDK steps.
        The HITL timeout is deliberately very long (days) and decoupled
        from the factory idle budget — the frontend auto-approves so the
        gate is purely a safety net.
        """
        floor = 720
        if self.factory_idle_timeout_seconds < floor:
            msg = (
                f"factory_idle_timeout_seconds ({self.factory_idle_timeout_seconds}) "
                f"must be >= {floor}. "
                f"Raise factory_idle_timeout_seconds."
            )
            raise ValueError(msg)
