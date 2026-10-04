"""Surah names as mp3quran.net publishes them, in each answer language. The fetch script saves them
to content/fetched/surahs.json and the ingest copies them into the committed index."""

import json
from functools import lru_cache
from pathlib import Path

from app.config import get_settings
from app.languages import Language

FILE = "surahs.json"


@lru_cache
def _names(index_dir: Path) -> dict[str, dict[str, str]]:
    path = index_dir / FILE
    if not path.exists():
        return {}
    names: dict[str, dict[str, str]] = json.loads(path.read_text(encoding="utf-8"))["names"]
    return names


def surah_name(surah: int, language: Language, index_dir: Path | None = None) -> str | None:
    names = _names(index_dir or get_settings().index_dir).get(str(surah), {})
    return names.get(language) or names.get("ar")
