from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

SERVICE_NAME = "rehla-ai"

AI_ROOT = Path(__file__).resolve().parents[1]
REPOSITORY_ROOT = AI_ROOT.parent


class Settings(BaseSettings):
    """Runtime configuration read from the environment (and `.env` locally).

    Every value is optional so the service can start, and report health, before keys exist.
    Model names are never hard-coded; they come only from these settings.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_ignore_empty=True,
        extra="ignore",
    )

    openrouter_api_key: SecretStr | None = None
    llm_model: str | None = None
    llm_fallback_model: str | None = None
    embedding_model: str | None = None
    # Lens reads photos with a vision model; without VLM_MODEL the /lens endpoint is unavailable.
    vlm_model: str | None = None
    vlm_fallback_model: str | None = None
    # OpenRouter's provider preference: "deny" keeps prompts away from providers that store them.
    openrouter_data_collection: Literal["allow", "deny"] = "deny"

    mcp_url: str = "https://mcp.islamiccontent.org/mcp"
    # Built by `uv run python -m app.ingest`; committed, so the deployed service needs no content/.
    index_dir: Path = AI_ROOT / "data" / "index"
    content_dir: Path = REPOSITORY_ROOT / "content"
    asks_per_minute: int = 10
    lens_per_minute: int = 5
    # Shared with the web app's proxy; when set, requests without it are refused (app/security.py).
    ai_service_key: SecretStr | None = None
    # Local diagnosis only: logs Rafiq's drafts and the problems found in them. Never in production.
    rafiq_debug: bool = False


@lru_cache
def get_settings() -> Settings:
    return Settings()
