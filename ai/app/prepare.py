"""Prepares ai/data/ so the service reads nothing outside ai/ at runtime.

On Vercel the project root is ai/, so only what lies under it is bundled. This script copies the
content the service reads while running (the surah names that label verse blocks, the ids of the
referral bodies, the key points of each Mawqif turn, and the organisers' glossary) from ../content
into ai/data/index/, and checks that the index built by `app.ingest` (committed) is complete. It
needs no model and no network.

Run it locally with `uv run python -m app.prepare`; Vercel runs it as the build step
(`[tool.vercel.scripts] build` in pyproject.toml). It stops with a clear message if a file
is missing.
"""

import json
import sys
from pathlib import Path
from typing import Any

from app.config import AI_ROOT, REPOSITORY_ROOT

CONTENT = REPOSITORY_ROOT / "content"
INDEX = AI_ROOT / "data" / "index"
SURAHS_FILE = "surahs.json"
REFERRALS_FILE = "referral-centers.json"
MAWQIF_FILE = "mawqif-turns.json"
ROAD_FILE = "road.json"
PRACTICE_FILE = "mawqif-practice.json"
GLOSSARY_FILE = "glossary-p7.json"
# Built by `uv run python -m app.ingest` (it embeds text) and committed with the code.
INDEX_FILES = ("chunks.jsonl", "vectors.npy", "meta.json")


class MissingFile(Exception):
    pass


def _read(path: Path) -> dict[str, Any]:
    if not path.is_file():
        raise MissingFile(
            f"{path} is missing. On Vercel, the ai project needs the setting "
            '"Include source files outside of the Root Directory in the Build Step" '
            "(on by default)."
        )
    data: dict[str, Any] = json.loads(path.read_text(encoding="utf-8"))
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


def copy_mawqif_turns(content: Path, index_dir: Path) -> None:
    """Each Mawqif turn's key points, in both languages, for judging a written reply. Only the
    quoted words the learner is asked to cover, never a whole source."""
    turns: dict[str, dict[str, list[dict[str, str]]]] = {}
    for path in sorted((content / "situations").glob("*.json")):
        situation = _read(path)
        if situation.get("status") != "published":
            continue
        turns[situation["id"]] = {
            exchange["id"]: [
                {"id": point["id"], "ar": point["quote"]["ar"], "en": point["quote"]["en"]}
                for point in exchange["keyPoints"]
            ]
            for exchange in situation["exchanges"]
        }
    _write(index_dir / MAWQIF_FILE, turns)


def copy_practice(content: Path, index_dir: Path) -> None:
    """What Mawqif's practice needs of each situation: its team wording (title, scene, character),
    its key points, every quote it shows by ref, and the words to say (learn.say), exactly as the
    situation quotes them: the only religious words a suggested better reply may include, inserted
    by code."""
    situations: dict[str, dict[str, Any]] = {}
    for path in sorted((content / "situations").glob("*.json")):
        situation = _read(path)
        if situation.get("status") != "published":
            continue
        quotes: dict[str, dict[str, str]] = {}
        for slot in situation["learn"].values():
            for quote in slot:
                quotes.setdefault(quote["ref"], {"ar": quote["ar"], "en": quote["en"]})
        points: dict[str, dict[str, str]] = {}
        for exchange in situation["exchanges"]:
            for point in exchange["keyPoints"]:
                quote = point["quote"]
                quotes.setdefault(quote["ref"], {"ar": quote["ar"], "en": quote["en"]})
                points.setdefault(
                    point["id"],
                    {"id": point["id"], "ref": quote["ref"], "ar": quote["ar"], "en": quote["en"]},
                )
        say = [
            {"id": f"s{n}", "ar": quote["ar"], "en": quote["en"]}
            for n, quote in enumerate(situation["learn"]["say"], start=1)
        ]
        situations[situation["id"]] = {
            "say": say,
            "title": situation["title"],
            "scene": situation["scene"],
            "character": situation["character"],
            "keyPoints": list(points.values()),
            "quotes": quotes,
            "lessons": situation.get("relatedLessons", []),
        }
    _write(index_dir / PRACTICE_FILE, situations)


def copy_road(content: Path, index_dir: Path) -> None:
    """The order of the stations and lessons on the road, by title only, so Rafiq can say which
    lesson comes next. No lesson text."""
    stations = sorted(
        (_read(path) for path in (content / "stations").glob("*.json")), key=lambda s: s["order"]
    )
    lessons = [_read(path) for path in sorted((content / "lessons").glob("*.json"))]
    published = [lesson for lesson in lessons if lesson.get("status") == "published"]

    def position(lesson: dict[str, Any]) -> tuple[int, ...]:
        return tuple(int(part) for part in str(lesson["id"]).split("."))

    road = [
        {
            "station": station["id"],
            "title": station["title"],
            "lessons": [
                {"id": lesson["id"], "title": lesson["title"]}
                for lesson in sorted(published, key=position)
                if str(lesson["station"]) == str(station["id"])
            ],
        }
        for station in stations
        if not station.get("demo")
    ]
    _write(index_dir / ROAD_FILE, road)


def copy_glossary(content: Path, index_dir: Path) -> None:
    """The organisers' glossary (page 7 of the scholarly package), as it is."""
    _write(index_dir / GLOSSARY_FILE, _read(content / GLOSSARY_FILE))


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
    copy_mawqif_turns(content, index_dir)
    copy_road(content, index_dir)
    copy_practice(content, index_dir)
    copy_glossary(content, index_dir)
    check_index(index_dir)
    return sorted(path.name for path in index_dir.iterdir() if path.is_file())


if __name__ == "__main__":
    try:
        files = prepare()
    except MissingFile as error:
        sys.exit(f"ai/data is not ready: {error}")
    print(f"ai/data/index is ready: {', '.join(files)}")
