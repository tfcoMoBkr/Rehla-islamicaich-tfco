"""Builds the answer the API returns from a checked and finished draft: text blocks between the
verse and hadith blocks, each verse or hadith inserted exactly as it was stored or retrieved, and
sources numbered in order of first citation."""

import re

from app.languages import Language
from app.rafiq.check import find_passage
from app.rafiq.draft import MARKER, Unit, render
from app.rafiq.schemas import (
    Block,
    HadithBlock,
    Level,
    QuranBlock,
    RafiqAnswer,
    Referral,
    SourceCard,
    TextBlock,
)
from app.retrieval.passages import Passage
from app.retrieval.surahs import surah_name


def compose(
    units: list[Unit],
    passages: list[Passage],
    language: Language,
    level: Level | None,
    referral: Referral | None = None,
    *,
    explanations: bool = False,
) -> RafiqAnswer:
    """`explanations` shows HadeethEnc's own explanation with each hadith (extractive answers)."""
    by_number = {passage.n: passage for passage in passages}
    order: list[int] = []
    # Two pieces of the same book section are one source for the reader.
    first_of: dict[tuple[str, str, str], int] = {}

    def cite(passage: Passage | None) -> int | None:
        if passage is None:
            return None
        number = first_of.setdefault((passage.title, passage.reference, passage.url), passage.n)
        if number not in order:
            order.append(number)
        return order.index(number) + 1

    def renumber(match: re.Match[str]) -> str:
        number = cite(by_number.get(int(match.group(1))))
        return f"[{number}]" if number else ""

    blocks: list[Block] = []
    pending: list[Unit] = []

    def flush() -> None:
        text = MARKER.sub(renumber, render(pending))
        # A marker said twice in a row ("[1][1]") is said once.
        text = re.sub(r"(\[\d+\])(?:\s*\1)+", r"\1", text).strip()
        if text:
            blocks.append(TextBlock(text=text))
        pending.clear()

    for unit in units:
        if unit.kind != "block" or not unit.block:
            pending.append(unit)
            continue
        flush()
        passage = find_passage(passages, *unit.block)
        number = cite(passage)
        if passage is None or number is None:
            continue
        if passage.verse:
            verse = passage.verse
            blocks.append(
                QuranBlock(
                    n=number,
                    ref=verse.ref,
                    surah=verse.surah,
                    ayah=verse.ayah,
                    surah_name=surah_name(verse.surah, language),
                    arabic=verse.arabic,
                    translation=verse.translation,
                    translation_language=verse.translation_language,
                    translation_key=verse.translation_key,
                    translation_name=verse.translation_name,
                    translation_version=verse.translation_version,
                    url=verse.url,
                )
            )
        elif passage.hadith:
            hadith = passage.hadith
            blocks.append(
                HadithBlock(
                    n=number,
                    id=hadith.id,
                    title=hadith.title,
                    arabic=hadith.arabic,
                    text=hadith.text,
                    text_language=hadith.text_language,
                    grade=hadith.grade,
                    attribution=hadith.attribution,
                    explanation=(hadith.explanation or None) if explanations else None,
                    url=hadith.url,
                )
            )
    flush()

    sources = [
        SourceCard(
            n=index,
            source_id=by_number[number].source_id,
            title=by_number[number].title,
            reference=by_number[number].reference,
            url=by_number[number].url,
            publisher=by_number[number].publisher,
        )
        for index, number in enumerate(order, start=1)
    ]
    return RafiqAnswer(
        language=language,
        level=level,
        referred=referral is not None,
        blocks=blocks,
        sources=sources,
        referral=referral,
    )
