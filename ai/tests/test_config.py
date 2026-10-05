import pytest

from app.config import Settings

ENV_VARS = (
    "OPENROUTER_API_KEY",
    "LLM_MODEL",
    "LLM_FALLBACK_MODEL",
    "EMBEDDING_MODEL",
)


def test_settings_load_without_any_keys(monkeypatch: pytest.MonkeyPatch) -> None:
    for name in ENV_VARS:
        monkeypatch.delenv(name, raising=False)

    settings = Settings(_env_file=None)

    assert settings.openrouter_api_key is None
    assert settings.llm_model is None


def test_empty_values_are_treated_as_unset(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_MODEL", "")

    assert Settings(_env_file=None).llm_model is None
