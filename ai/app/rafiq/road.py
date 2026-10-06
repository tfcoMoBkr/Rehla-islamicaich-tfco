"""The learner's road, as everyday talk sees it: which lessons they have completed, and which one
comes next, by title (data/index/road.json, written by app/prepare.py). Rafiq uses it to answer
"what should I study next?" without any source: it is the app's own map, not religious content."""

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from app.rafiq.schemas import PageLocale


@dataclass(frozen=True)
class Lesson:
    id: str
    station: str
    title: dict[str, str]


class Road:
    def __init__(self, stations: list[dict[str, Any]]) -> None:
        self._titles = {str(s["station"]): s["title"] for s in stations}
        self._lessons = [
            Lesson(str(lesson["id"]), str(s["station"]), lesson["title"])
            for s in stations
            for lesson in s["lessons"]
        ]

    @classmethod
    def load(cls, path: Path) -> "Road | None":
        if not path.is_file():
            return None
        return cls(json.loads(path.read_text(encoding="utf-8")))

    def describe(self, reached: list[str] | None, locale: PageLocale) -> str:
        """A few plain lines for the talk prompt: done, and next."""
        done = [lesson for lesson in self._lessons if lesson.id in set(reached or [])]
        upcoming = next(
            (lesson for lesson in self._lessons if lesson.id not in set(reached or [])), None
        )
        lines = [
            f"Lessons completed: {len(done)} of {len(self._lessons)}"
            + (f" (latest: {done[-1].title[locale]})" if done else "")
        ]
        if upcoming:
            station = self._titles.get(upcoming.station, {}).get(locale, "")
            lines.append(f"Next lesson: {upcoming.title[locale]} (station: {station})")
        else:
            lines.append("Every lesson on the road is completed; practice and situations remain.")
        return "\n".join(lines)


def unknown_road() -> str:
    return "Not known: the learner's progress was not shared."
