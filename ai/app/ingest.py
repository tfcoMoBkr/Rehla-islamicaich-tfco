"""Builds Rafiq's index in ai/data/index/ from content/ (run: `uv run python -m app.ingest`).

Inputs: every book in content/corpus/index.json (corpus books and the lesson books in
content/fetched/books), the terms and the hadith catalogue in content/corpus/, and the hadiths
and verses the lessons reference (content/fetched/hadith, content/fetched/quran). Embeddings are
reused by content hash from the previous index, so re-running costs nothing for unchanged chunks.
"""

import asyncio
import hashlib
import json
import re
from datetime import date
from pathlib import Path
from typing import Any

import httpx
import numpy as np

from app.config import get_settings
from app.index import Chunk, Index, IndexMeta, Language
from app.llm import OpenRouterEmbedder
from app.rafiq.specialists import FILE as REFERRALS_FILE
from app.retrieval.surahs import FILE as SURAHS_FILE

TARGET = 800
LONG_PARAGRAPH = 1200
SUBHEADING = 90
LANGUAGES: tuple[Language, ...] = ("ar", "en")

# content/sources.json ids of the books, by their id in content/corpus/index.json.
BOOK_SOURCES = {
    "byenah-4784": "byenah-new-muslim-guideline",
    "islamhouse-2831443": "ih-almukhtasar-almufid",
    "1871": "ih-durus-muhimmah",
    "2842316": "risala-important-lessons",
    "62675": "ih-salat-nabi",
    "1261": "ih-salat-nabi",
}
# Paragraph styles a book uses for Quran verses: verses never come from a book's text.
VERSE_STYLES = {"byenah-4784": {"Style1"}}
QURAN_TITLE = {"ar": "القرآن الكريم", "en": "The Holy Quran"}

Json = dict[str, Any]


def read(path: Path) -> Json:
    data: Json = json.loads(path.read_text(encoding="utf-8"))
    return data


def digest(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def is_subheading(paragraph: str) -> bool:
    """A short line that introduces what follows, such as "When ablution is due:"."""
    return len(paragraph) <= SUBHEADING and paragraph.rstrip().endswith(":")


def book_context(heading: str, text: str) -> str:
    """What a book piece is embedded with: its own opening subheading, or else the section's."""
    if not heading or is_subheading(text.split("\n\n", 1)[0]):
        return text
    return f"{heading}\n{text}"


def book_reference(heading: str, text: str) -> str:
    """Where a piece sits in its book: its own opening subheading, or else the section heading."""
    lead = text.split("\n\n", 1)[0]
    return (lead if is_subheading(lead) else heading).rstrip(" :")


def pieces(paragraphs: list[str]) -> list[str]:
    """About TARGET characters each, cut at paragraph ends (a long paragraph at sentence ends).

    A subheading inside a section starts a new piece, so that each piece keeps to one topic."""
    units: list[str] = []
    for paragraph in paragraphs:
        if len(paragraph) <= LONG_PARAGRAPH:
            units.append(paragraph)
            continue
        sentence: list[str] = []
        for part in re.split(r"(?<=[.!?؟۔])\s+", paragraph):
            if sentence and len(" ".join([*sentence, part])) > TARGET:
                units.append(" ".join(sentence))
                sentence = []
            sentence.append(part)
        if sentence:
            units.append(" ".join(sentence))
    chunks: list[list[str]] = []
    for unit in units:
        fits = chunks and len("\n\n".join([*chunks[-1], unit])) <= TARGET
        if fits and not is_subheading(unit):
            chunks[-1].append(unit)
        else:
            chunks.append([unit])
    return ["\n\n".join(chunk) for chunk in chunks]


class Sources:
    """The inputs, read once."""

    def __init__(self, content: Path) -> None:
        self.content = content
        corpus = content / "corpus"
        self.books: list[Json] = read(corpus / "index.json")["books"]
        self.coverage: dict[str, Json] = read(corpus / "coverage.json")["lessons"]
        self.catalogue: Json = read(corpus / "hadith-catalogue.json")
        self.terms = [read(path) for path in sorted((corpus / "terms").glob("*.json"))]
        self.hadiths = [
            read(path) for path in sorted((content / "fetched" / "hadith").glob("*.json"))
        ]
        self.verses = [
            read(path) for path in sorted((content / "fetched" / "quran").glob("*.json"))
        ]
        self.lesson_refs = self._lesson_references()

    def _lesson_references(self) -> dict[str, set[str]]:
        """Which lessons cite each hadith ("hadith:ID") and verse ("quran:S:A")."""
        found: dict[str, set[str]] = {}

        def visit(value: object, lesson: str) -> None:
            if isinstance(value, list):
                for item in value:
                    visit(item, lesson)
                return
            if not isinstance(value, dict):
                return
            if value.get("type") == "hadith" and value.get("hadeethencId"):
                found.setdefault(f"hadith:{value['hadeethencId']}", set()).add(lesson)
            # Lesson files give every verse reference as "ref": "s:a" or "s:a-b".
            ref = value.get("ref")
            match = re.fullmatch(r"(\d+):(\d+)(?:-(\d+))?", ref) if isinstance(ref, str) else None
            if match:
                surah, first, last = int(match[1]), int(match[2]), int(match[3] or match[2])
                for ayah in range(first, last + 1):
                    found.setdefault(f"quran:{surah}:{ayah}", set()).add(lesson)
            for item in value.values():
                visit(item, lesson)

        for path in sorted((self.content / "lessons" / "drafts").glob("*.json")):
            lesson = read(path)
            visit(lesson, lesson["id"])
        return found

    def lessons_for_section(self, book: str, anchor: str) -> list[str]:
        return sorted(
            lesson
            for lesson, entry in self.coverage.items()
            if any(
                section["book"] == book and section["anchor"] == anchor
                for section in entry["sections"]
            )
        )

    def lessons_for_categories(self, categories: list[int]) -> list[str]:
        return sorted(
            lesson
            for lesson, entry in self.coverage.items()
            if set(entry["categories"]) & set(categories)
        )


def book_chunks(sources: Sources) -> list[Chunk]:
    chunks: list[Chunk] = []
    for book in sources.books:
        directory = sources.content.parent / book["path"]
        verse_styles = VERSE_STYLES.get(book["id"], set())
        for path in sorted(directory.glob("*.json")):
            if path.name == "index.json":
                continue
            section = read(path)
            paragraphs = [
                paragraph["text"]
                for paragraph in section["paragraphs"]
                if not paragraph.get("quranGlyphs")
                and not paragraph.get("arabicFromPdf")
                and paragraph.get("style") not in verse_styles
            ]
            heading = section.get("heading") or ""
            lessons = sources.lessons_for_section(book["id"], section["anchor"])
            for number, text in enumerate(pieces(paragraphs), start=1):
                chunks.append(
                    Chunk(
                        id=f"book:{book['id']}:{section['anchor']}:{number}",
                        lang=book["language"],
                        type="book",
                        source_id=BOOK_SOURCES[book["id"]],
                        title=book["title"],
                        reference=book_reference(heading, text) or f"§{section['anchor']}",
                        url=section["source"]["url"],
                        publisher=section["source"]["publisher"],
                        lesson_ids=lessons,
                        text=text,
                        hash=digest(book_context(heading, text)),
                        extra={"book": book["id"], "anchor": section["anchor"], "heading": heading},
                    )
                )
    return chunks


def term_chunks(sources: Sources) -> list[Chunk]:
    chunks: list[Chunk] = []
    for term in sources.terms:
        for language, page in term["languages"].items():
            fields = page["fields"]
            name = next(
                (field["text"] for field in fields if field["field"] == "title"), str(term["id"])
            )
            text = "\n".join(
                f"{field['section']}: {field['text']}" if field.get("section") else field["text"]
                for field in fields
            )
            chunks.append(
                Chunk(
                    id=f"term:{term['id']}:{language}",
                    lang=language,
                    type="term",
                    source_id="terminologyenc",
                    title=name,
                    reference=f"#{term['id']}",
                    url=page["url"],
                    publisher=term["source"]["publisher"],
                    text=text,
                    hash=digest(text),
                    extra={"termId": term["id"]},
                )
            )
    return chunks


def catalogue_chunks(sources: Sources) -> list[Chunk]:
    catalogue = sources.catalogue
    publisher = catalogue["source"]["publisher"]
    chunks: list[Chunk] = []
    for category in catalogue["categories"]:
        if not category["chosen"]:
            continue
        for language in LANGUAGES:
            title = category["title"].get(language)
            if not title:
                continue
            chunks.append(
                Chunk(
                    id=f"catalogue:category:{category['id']}:{language}",
                    lang=language,
                    type="catalogue",
                    source_id="hadeethenc",
                    title=title,
                    reference=f"category {category['id']}",
                    url=f"https://hadeethenc.com/{language}/browse/category/{category['id']}",
                    publisher=publisher,
                    lesson_ids=sources.lessons_for_categories([category["id"]]),
                    text=title,
                    hash=digest(title),
                    extra={"categoryId": category["id"]},
                )
            )
    for hadith in catalogue["hadiths"]:
        for language, title in hadith["title"].items():
            chunks.append(
                Chunk(
                    id=f"catalogue:hadith:{hadith['id']}:{language}",
                    lang=language,
                    type="catalogue",
                    source_id="hadeethenc",
                    title=title,
                    reference=f"#{hadith['id']}",
                    url=hadith["url"][language],
                    publisher=publisher,
                    lesson_ids=sources.lessons_for_categories(hadith["categories"]),
                    text=title,
                    hash=digest(title),
                    extra={"hadithId": hadith["id"], "categoryIds": hadith["categories"]},
                )
            )
    return chunks


def hadith_chunks(sources: Sources) -> list[Chunk]:
    chunks: list[Chunk] = []
    for hadith in sources.hadiths:
        lessons = sorted(sources.lesson_refs.get(f"hadith:{hadith['id']}", set()))
        for language, version in hadith["languages"].items():
            parts = {
                "text": version["hadeeth"],
                "explanation": version.get("explanation") or "",
                "hints": "\n".join(version.get("hints") or []),
            }
            for part, text in parts.items():
                if not text.strip():
                    continue
                chunks.append(
                    Chunk(
                        id=f"hadith:{hadith['id']}:{language}:{part}",
                        lang=language,
                        type="hadith",
                        source_id="hadeethenc",
                        title=version["title"],
                        reference=f"#{hadith['id']}",
                        url=version["url"],
                        publisher=hadith["publisher"],
                        lesson_ids=lessons,
                        text=text,
                        hash=digest(f"{version['title']}\n{text}"),
                        extra={
                            "hadithId": hadith["id"],
                            "part": part,
                            "grade": version["grade"],
                            "attribution": version["attribution"],
                            "hadith": version["hadeeth"],
                        },
                    )
                )
    return chunks


def quran_chunks(sources: Sources) -> list[Chunk]:
    chunks: list[Chunk] = []
    for verse in sources.verses:
        surah, ayah = (int(part) for part in verse["ref"].split(":"))
        translation = verse["translations"]["en"]
        lessons = sorted(sources.lesson_refs.get(f"quran:{surah}:{ayah}", set()))
        texts: dict[Language, str] = {"ar": verse["arabic"], "en": translation["text"]}
        for language, text in texts.items():
            chunks.append(
                Chunk(
                    id=f"quran:{surah}:{ayah}:{language}",
                    lang=language,
                    type="quran",
                    source_id="quranenc",
                    title=QURAN_TITLE[language],
                    reference=f"{surah}:{ayah}",
                    url=verse["source"]["url"],
                    publisher=verse["source"]["publisher"],
                    lesson_ids=lessons,
                    text=text,
                    hash=digest(text),
                    extra={
                        "surah": surah,
                        "ayah": ayah,
                        "arabic": verse["arabic"],
                        "translation": translation["text"],
                        "translationKey": translation["key"],
                        "translationVersion": translation["version"],
                    },
                )
            )
    return chunks


def embed_text(chunk: Chunk) -> str:
    if chunk.type == "book":
        return book_context(str(chunk.extra.get("heading", "")), chunk.text)
    if chunk.type == "hadith":
        return f"{chunk.title}\n{chunk.text}"
    return chunk.text


async def build() -> None:
    settings = get_settings()
    sources = Sources(settings.content_dir)
    chunks = [
        *book_chunks(sources),
        *term_chunks(sources),
        *catalogue_chunks(sources),
        *hadith_chunks(sources),
        *quran_chunks(sources),
    ]

    cached: dict[str, np.ndarray] = {}
    if (settings.index_dir / "meta.json").exists():
        previous = Index.load(settings.index_dir)
        if previous.meta and previous.meta.embedding_model == settings.embedding_model:
            cached = {
                chunk.hash: previous.vectors[position]
                for position, chunk in enumerate(previous.chunks)
            }

    missing = [chunk for chunk in chunks if chunk.hash not in cached]
    reused = len(chunks) - len(missing)
    print(f"{len(chunks)} chunks, {reused} vectors reused, {len(missing)} to embed")
    async with httpx.AsyncClient() as client:
        embedder = OpenRouterEmbedder(settings, client)
        if missing:
            vectors = await embedder.embed([embed_text(chunk) for chunk in missing])
            cached.update({chunk.hash: vectors[position] for position, chunk in enumerate(missing)})

    matrix = np.stack([cached[chunk.hash] for chunk in chunks])
    counts: dict[str, int] = {}
    for chunk in chunks:
        key = f"{chunk.type}:{chunk.lang}"
        counts[key] = counts.get(key, 0) + 1
    meta = IndexMeta(
        embeddingModel=settings.embedding_model or "",
        dimensions=int(matrix.shape[1]),
        chunks=len(chunks),
        builtOn=date.today().isoformat(),
        counts=dict(sorted(counts.items())),
    )
    Index(chunks, matrix, meta).save(settings.index_dir, meta)
    copy_surah_names(settings.content_dir, settings.index_dir)
    copy_referral_ids(settings.content_dir, settings.index_dir)
    print(f"Index written to {settings.index_dir}: {json.dumps(meta.counts)}")


def copy_surah_names(content: Path, index_dir: Path) -> None:
    """The surah names verse blocks are labelled with, so the service needs no content/."""
    names = read(content / "fetched" / "surahs.json")
    (index_dir / SURAHS_FILE).write_text(
        json.dumps(names, ensure_ascii=False, indent=1) + "\n", encoding="utf-8"
    )


def copy_referral_ids(content: Path, index_dir: Path) -> None:
    """The ids of the referral bodies, national channel first: the service names them, the web
    renders them from content/referral-centers.json."""
    centres = read(content / "referral-centers.json")["centers"]
    ids = [c["id"] for c in centres if c["type"] == "nationalChannel"]
    ids += [c["id"] for c in centres if c["type"] != "nationalChannel"]
    (index_dir / REFERRALS_FILE).write_text(
        json.dumps({"ids": ids}, indent=1) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    asyncio.run(build())
