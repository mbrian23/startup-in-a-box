"""Factory settings — minimal config for the Claude Agent SDK runner."""

from __future__ import annotations

from pathlib import Path

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_REPO_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    port: int = 8888
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000"])

    # Forwarded to the Claude CLI via ClaudeAgentOptions.env.
    # LM Studio in Anthropic-compatible mode, real Anthropic API, or any
    # gateway that speaks the Messages API — all work by just setting these.
    anthropic_api_key: str = ""
    anthropic_base_url: str = ""

    # Non-interactive Vercel CLI token. When set, the devops subagent
    # deploys with `vercel --prod --yes --token $VERCEL_TOKEN`. When
    # unset, the factory builds the site locally and skips the deploy
    # step — the output lives in the workspace directory.
    vercel_token: str = ""

    # Top-level runner model. The runner owns the build loop (decides which
    # subagent to call, when to stop) and its output is short + high-leverage,
    # so it runs on Opus. Subagents pin their own tier in ``subagents.py``
    # (architect=opus, implementer/build_reviewer=sonnet, tester/devops=haiku)
    # so rate-limit pressure is spread across all three model buckets.
    factory_model: str = "anthropic/claude-opus-4.7"
    workspace_root: str = "workspace"
    repo_root: str = str(_REPO_ROOT)

    @model_validator(mode="after")
    def _resolve_workspace_root(self) -> "Settings":
        if not Path(self.workspace_root).is_absolute():
            self.workspace_root = str(_REPO_ROOT / "factory" / self.workspace_root)
        return self

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_csv(cls, value: object) -> object:
        if isinstance(value, str):
            return [o.strip() for o in value.split(",") if o.strip()]
        return value
