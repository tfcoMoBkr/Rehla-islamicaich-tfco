"""Passages: what the model reads and what an answer may cite. A verse or a hadith carries its
published texts separately (the Arabic, and the published translation with its language), so it is
shown only as it was stored or retrieved, never as written by the model."""

from typing import Literal

from pydantic import BaseModel

from app.index import Chunk
from app.languages import LANGUAGES, Language, QuranTranslation
from app.retrieval.mcp_text import McpHadith, McpVerse

PassageType = Literal["book", "hadith", "quran", "term"]

QURAN_TITLE = {"ar": "القرآن الكريم", "en": "The Holy Quran"}


class VerseText(BaseModel):
    ref: str
    surah: int
    ayah: int
    arabic: str
    translation: str | None = None
    translation_language: Language | None = None
    translation_key: str | None = None
    translation_name: str | None = None
    translation_version: str | None = None
    url: str


class HadithText(BaseModel):
    id: int
    title: str
    arabic: str
    # The published translation; None when the passage is the Arabic itself.
    text: str | None = None
    text_language: Language | None = None
    grade: str
    attribution: str
    explanation: str = ""
    url: str


class Passage(BaseModel):
    n: int = 0
    type: PassageType
    # The language of the passage's readable text.
    lang: Language
    source_id: str
    title: str
    reference: str
    url: str
    publisher: str
    text: str
    verse: VerseText | None = None
    hadith: HadithText | None = None
    # A question-and-answer book's answer to one question (one chunk per question).
    answers_a_question: bool = False

    @property
    def key(self) -> str:
        if self.verse:
            return f"quran:{self.verse.ref}"
        if self.hadith:
            return f"hadith:{self.hadith.id}"
        return f"{self.type}:{self.url}:{self.reference}:{self.text[:40]}"

    @property
    def sacred(self) -> bool:
        return self.verse is not None or self.hadith is not None

    def sacred_texts(self) -> list[str]:
        """The published wording a model must never write out itself."""
        if self.verse:
            return [t for t in (self.verse.arabic, self.verse.translation) if t]
        if self.hadith:
            return [t for t in (self.hadith.arabic, self.hadith.text) if t]
        return []


def quran_title(language: Language) -> str:
    return QURAN_TITLE.get(language, QURAN_TITLE["ar"])


def from_chunk(chunk: Chunk) -> Passage:
    """A book, term or stored verse chunk as a passage (hadith chunks: `from_hadith_chunks`)."""
    verse = None
    text = chunk.text
    if chunk.type == "quran":
        surah, ayah = (int(part) for part in chunk.reference.split(":"))
        english = chunk.lang == "en"
        key = str(chunk.extra["translationKey"])
        own = LANGUAGES["en"].quran
        verse = VerseText(
            ref=chunk.reference,
            surah=surah,
            ayah=ayah,
            arabic=str(chunk.extra["arabic"]),
            translation=str(chunk.extra["translation"]) if english else None,
            translation_language="en" if english else None,
            translation_key=key if english else None,
            translation_name=(own.name if own and own.key == key else key) if english else None,
            translation_version=str(chunk.extra.get("translationVersion")) if english else None,
            url=chunk.url,
        )
        text = f"{verse.arabic}\n{verse.translation}" if verse.translation else verse.arabic
    return Passage(
        type="quran" if chunk.type == "quran" else ("term" if chunk.type == "term" else "book"),
        lang=chunk.lang,
        source_id=chunk.source_id,
        title=chunk.title,
        reference=chunk.reference,
        url=chunk.url,
        publisher=chunk.publisher,
        text=text,
        verse=verse,
        answers_a_question=bool(chunk.extra.get("question")),
    )


def from_hadith_chunks(chunks: list[Chunk], arabic: str) -> Passage:
    """A stored hadith (content/fetched/hadith) in one language, with its stored Arabic text."""
    first = chunks[0]
    parts = {str(chunk.extra["part"]): chunk.text for chunk in chunks}
    explanation = parts.get("explanation", "")
    published = str(first.extra["hadith"])
    in_arabic = first.lang == "ar"
    return Passage(
        type="hadith",
        lang=first.lang,
        source_id=first.source_id,
        title=first.title,
        reference=first.reference,
        url=first.url,
        publisher=first.publisher,
        text="\n\n".join(part for part in (published, explanation) if part),
        hadith=HadithText(
            id=int(str(first.extra["hadithId"])),
            title=first.title,
            arabic=published if in_arabic else arabic,
            text=None if in_arabic else published,
            text_language=None if in_arabic else first.lang,
            grade=str(first.extra["grade"]),
            attribution=str(first.extra["attribution"]),
            explanation=explanation,
            url=first.url,
        ),
    )


def from_mcp_hadith(versions: dict[str, McpHadith], language: Language) -> Passage | None:
    """A hadith read live: its Arabic, and the version in `language` (or the fallback one)."""
    arabic = versions.get("ar")
    if arabic is None:
        return None
    if language == "ar":
        shown, shown_language = arabic, "ar"
    else:
        shown_language = language if language in versions else "en"
        if shown_language not in versions:
            return None
        shown = versions[shown_language]
    readable: Language = shown_language  # type: ignore[assignment]
    return Passage(
        type="hadith",
        lang=readable,
        source_id="hadeethenc",
        title=shown.title,
        reference=f"#{shown.id}",
        url=shown.url,
        publisher="HadeethEnc.com",
        text="\n\n".join(part for part in (shown.text, shown.explanation) if part),
        hadith=HadithText(
            id=shown.id,
            title=shown.title,
            arabic=arabic.text,
            text=None if readable == "ar" else shown.text,
            text_language=None if readable == "ar" else readable,
            grade=shown.grade,
            attribution=shown.attribution,
            explanation=shown.explanation,
            url=shown.url,
        ),
    )


def from_mcp_verse(
    verse: McpVerse,
    language: Language,
    translation: tuple[Language, QuranTranslation] | None,
) -> Passage:
    """A verse read live, with the translation it was asked for (none for Arabic)."""
    ref = f"{verse.surah}:{verse.ayah}"
    shown = verse.translation if translation else None
    translated_in, published = translation if translation and shown else (None, None)
    return Passage(
        type="quran",
        lang=translated_in or "ar",
        source_id="quranenc",
        title=quran_title(language),
        reference=ref,
        url=verse.url,
        publisher="QuranEnc.com",
        text=f"{verse.arabic}\n{shown}" if shown else verse.arabic,
        verse=VerseText(
            ref=ref,
            surah=verse.surah,
            ayah=verse.ayah,
            arabic=verse.arabic,
            translation=shown,
            translation_language=translated_in,
            translation_key=published.key if published else None,
            translation_name=published.name if published else None,
            translation_version=published.version if published else None,
            url=verse.url,
        ),
    )
