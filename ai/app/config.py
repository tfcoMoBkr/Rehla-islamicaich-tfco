from functools import lru_cache

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

SERVICE_NAME = "rehla-ai"


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
    supabase_url: str | None = None
    supabase_service_role_key: SecretStr | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()
