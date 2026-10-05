"""Prepares ai/data/ so the service reads nothing outside ai/ at runtime.

On Vercel the project root is ai/, so only what lies under it is bundled. This script copies the
two content files the service reads while running (the surah names that label verse blocks, and
the ids of the referral bodies) from ../content into ai/data/index/, and checks that the index
built by `app.ingest` (committed) is complete. It needs no model and no network.

Run it locally with `uv run python -m app.prepare`; Vercel runs it as the build step
(`[tool.vercel.scripts] build` in pyproject.toml). It stops with a clear message if a file
is missing.
"""

import json
import sys
from pathlib import Path

from app.config import AI_ROOT, REPOSITORY_ROOT

CONTENT = REPOSITORY_ROOT / "content"
INDEX = AI_ROOT / "data" / "index"
SURAHS_FILE = "surahs.json"
REFERRALS_FILE = "referral-centers.json"
# Built by `uv run python -m app.ingest` (it embeds text) and committed with the code.
INDEX_FILES = ("chunks.jsonl", "vectors.npy", "meta.json")


class MissingFile(Exception):
    pass


def _read(path: Path) -> dict:
    if not path.is_file():
        raise MissingFile(
            f"{path} is missing. On Vercel, the ai project needs the setting "
            '"Include source files outside of the Root Directory in the Build Step" '
            "(on by default)."
        )
    data: dict = json.loads(path.read_text(encoding="utf-8"))
    return data


def _write(path: Path, data: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(data, ensure_ascii=False, indent=1) + "\n"
    path.write_text(text, encoding="utf-8", newline="\n")


def copy_surah_names(content: Path, index_dir: Path) -> None:
    """The surah names verse blocks are labelled with, as mp3quran.net publishes them."""
    _write(index_dir / SURAHS_FILE, _read(content / "fetched" / "surahs.json"))


def copy_referral_ids(content: Path, index_dir: Path) -> None:
    """The ids of the referral bodies, national channel first: the service names them, the web
    renders them from content/referral-centers.json."""
    centres = _read(content / "referral-centers.json")["centers"]
    ids = [c["id"] for c in centres if c["type"] == "nationalChannel"]
    ids += [c["id"] for c in centres if c["type"] != "nationalChannel"]
    _write(index_dir / REFERRALS_FILE, {"ids": ids})


def check_index(index_dir: Path) -> None:
    missing = [name for name in INDEX_FILES if not (index_dir / name).is_file()]
    if missing:
        raise MissingFile(
            f"{index_dir} lacks {', '.join(missing)}. Build the index with "
            "`uv run python -m app.ingest` and commit ai/data/index/."
        )


def prepare(content: Path = CONTENT, index_dir: Path = INDEX) -> list[str]:
    copy_surah_names(content, index_dir)
    copy_referral_ids(content, index_dir)
    check_index(index_dir)
    return sorted(path.name for path in index_dir.iterdir() if path.is_file())


if __name__ == "__main__":
    try:
        files = prepare()
    except MissingFile as error:
        sys.exit(f"ai/data is not ready: {error}")
    print(f"ai/data/index is ready: {', '.join(files)}")
