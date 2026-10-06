"""The learner's road, as everyday talk sees it: which lessons they have completed, and which one
comes next, by title (data/index/road.json, written by app/prepare.py). Rafiq uses it to answer
"what should I study next?" without any source: it is the app's own map, not religious content."""

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from app.rafiq.schemas import PageLocale
from app.text import tokens


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
        """A few plain lines for the talk prompt: done, next, and the whole road by id."""
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
        lines.append("The road's lessons, in order:")
        lines += [f"- {lesson.id}: {lesson.title[locale]}" for lesson in self._lessons]
        return "\n".join(lines)

    def planned(self, question: str, reached: list[str] | None) -> Lesson | None:
        """The lesson to study next: the one after the lesson the question names (by the words of
        its title, in either language; the later one on a tie), or else the learner's next one."""
        asked = set(tokens(question))
        best, overlap = None, 0
        for index, lesson in enumerate(self._lessons):
            shared = len(asked & {t for title in lesson.title.values() for t in tokens(title)})
            if shared and shared >= overlap:
                best, overlap = index, shared
        if best is not None:
            return self._lessons[best + 1] if best + 1 < len(self._lessons) else None
        return next(
            (lesson for lesson in self._lessons if lesson.id not in set(reached or [])), None
        )

    def title(self, lesson_id: str, locale: PageLocale) -> str | None:
        found = next((lesson for lesson in self._lessons if lesson.id == lesson_id), None)
        return found.title[locale] if found else None


def unknown_road() -> str:
    return "Not known: the learner's progress was not shared."
