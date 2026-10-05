"""Words in lesson cards marked with a stored TerminologyEnc term: the word is the card's own text,
and the index holds the term in both languages, tagged with the lesson."""

import json
from dataclasses import dataclass
from pathlib import Path

import pytest

from app.index import Index

ROOT = Path(__file__).resolve().parents[2]
LESSONS = ROOT / "content" / "lessons"
INDEX = Path(__file__).resolve().parents[1] / "data" / "index"


@dataclass(frozen=True)
class Mark:
    lesson: str
    card: str
    card_text: dict[str, str]
    term_id: int
    word: dict[str, str]


def marks() -> list[Mark]:
    found = []
    for path in sorted(LESSONS.glob("*.json")):
        lesson = json.loads(path.read_text(encoding="utf-8"))
        for card in lesson["cards"]:
            for mark in card.get("terms", []):
                found.append(
                    Mark(
                        lesson["id"],
                        card["id"],
                        card["text"],
                        mark["terminologyencId"],
                        mark["word"],
                    )
                )
    return found


@pytest.mark.parametrize("mark", marks())
def test_a_marked_word_is_in_the_card_text(mark: Mark) -> None:
    for language, word in mark.word.items():
        assert word in mark.card_text[language], f"{mark.lesson} {mark.card} {language}"


@pytest.mark.skipif(not (INDEX / "chunks.jsonl").exists(), reason="ai/data/index is not built")
@pytest.mark.parametrize("mark", marks())
def test_a_marked_term_is_indexed_with_its_lesson(mark: Mark) -> None:
    index = Index.load(INDEX)
    for language in ("ar", "en"):
        term = index.chunks[index.by_id[f"term:{mark.term_id}:{language}"]]
        assert mark.lesson in term.lesson_ids
        assert term.url.startswith("https://terminologyenc.com/")
