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
from app.index import Chunk, Index, IndexMeta, Language, is_subheading
from app.llm import OpenRouterEmbedder
from app.prepare import prepare

TARGET = 800
LONG_PARAGRAPH = 1200
LANGUAGES: tuple[Language, ...] = ("ar", "en")

# content/sources.json ids of the books, by their id in content/corpus/index.json.
BOOK_SOURCES = {
    "byenah-4784": "byenah-new-muslim-guideline",
    "islamhouse-2831443": "ih-almukhtasar-almufid",
    "1871": "ih-durus-muhimmah",
    "2842316": "risala-important-lessons",
    "62675": "ih-salat-nabi",
    "1261": "ih-salat-nabi",
    "dawa-7937": "dawa-bayyinat",
}
# Books whose text comes from a PDF text layer that extracts lines or letters out of order: they
# are searched and cited, but never quoted to the reader as a verbatim block.
FROM_PDF = {"dawa-7937", "islamhouse-2831443", "1261", "2842316"}
# The parts of a question-and-answer book's question that are indexed.
QUESTION_PARTS = ("question", "summary")
# A verse in a private-use glyph font, with the brackets around it.
GLYPH_VERSE = re.compile(
    r"[\ufd3e\ufd3f]?[\s\ue000-\uf8ff]*[\ue000-\uf8ff][\s\ue000-\uf8ff]*[\ufd3e\ufd3f]?"
)
# Paragraph styles a book uses for Quran verses: verses never come from a book's text.
VERSE_STYLES = {"byenah-4784": {"Style1"}}
QURAN_TITLE = {"ar": "القرآن الكريم", "en": "The Holy Quran"}

Json = dict[str, Any]


def read(path: Path) -> Json:
    data: Json = json.loads(path.read_text(encoding="utf-8"))
    return data


def digest(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def book_context(heading: str, text: str) -> str:
    """What a book piece is embedded with: the section heading, then the piece. A piece's own
    opening subheading, such as "They are six:", may not name its subject."""
    return f"{heading}\n{text}" if heading else text


def book_reference(heading: str, text: str) -> str:
    """Where a piece sits in its book: the section heading, then the piece's own opening
    subheading when it has one."""
    first = text.split("\n\n", 1)[0]
    heading, lead = heading.rstrip(" :"), first.rstrip(" :")
    if not is_subheading(first) or lead in heading:
        return heading
    return f"{heading} — {lead}" if heading and heading not in lead else lead


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
        """Which lessons cite each hadith ("hadith:ID"), verse ("quran:S:A") and TerminologyEnc
        term ("term:ID")."""
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
            if value.get("terminologyencId"):
                found.setdefault(f"term:{value['terminologyencId']}", set()).add(lesson)
            # Lesson files give every verse reference as "ref": "s:a" or "s:a-b".
            ref = value.get("ref")
            match = re.fullmatch(r"(\d+):(\d+)(?:-(\d+))?", ref) if isinstance(ref, str) else None
            if match:
                surah, first, last = int(match[1]), int(match[2]), int(match[3] or match[2])
                for ayah in range(first, last + 1):
                    found.setdefault(f"quran:{surah}:{ayah}", set()).add(lesson)
            for item in value.values():
                visit(item, lesson)

        for path in sorted((self.content / "lessons").glob("*.json")):
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


def without_glyph_verses(text: str) -> str:
    """The text without verses set in a private-use glyph font: they spell nothing, and verses
    are taken from their own source."""
    return re.sub(r"[ \t]{2,}", " ", GLYPH_VERSE.sub(" ", text)).strip()


def question_chunk(book: Json, section: Json, lessons: list[str]) -> Chunk:
    """A question-and-answer book: one chunk per question, the question with the book's own
    summary answer (its detailed answer stays in the corpus)."""
    heading = section.get("heading") or ""
    text = "\n\n".join(
        without_glyph_verses(paragraph["text"])
        for paragraph in section["paragraphs"]
        if paragraph.get("part") in QUESTION_PARTS
    )
    return Chunk(
        id=f"book:{book['id']}:{section['anchor']}:1",
        lang=book["language"],
        type="book",
        source_id=BOOK_SOURCES[book["id"]],
        title=book["title"],
        reference=heading or f"§{section['anchor']}",
        url=section["source"]["url"],
        publisher=section["source"]["publisher"],
        lesson_ids=lessons,
        text=text,
        hash=digest(book_context(heading, text)),
        extra={
            "book": book["id"],
            "anchor": section["anchor"],
            "heading": heading,
            "question": True,
            "verbatim": book["id"] not in FROM_PDF,
        },
    )


def book_chunks(sources: Sources) -> list[Chunk]:
    chunks: list[Chunk] = []
    for book in sources.books:
        directory = sources.content.parent / book["path"]
        verse_styles = VERSE_STYLES.get(book["id"], set())
        by_question = (directory / "index.json").is_file() and read(directory / "index.json").get(
            "chunking"
        ) == "question"
        for path in sorted(directory.glob("*.json")):
            if path.name == "index.json":
                continue
            section = read(path)
            if by_question:
                lessons = sources.lessons_for_section(book["id"], section["anchor"])
                chunks.append(question_chunk(book, section, lessons))
                continue
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
                        extra={
                            "book": book["id"],
                            "anchor": section["anchor"],
                            "heading": heading,
                            "verbatim": book["id"] not in FROM_PDF,
                        },
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
                    lesson_ids=sorted(sources.lesson_refs.get(f"term:{term['id']}", set())),
                    text=text,
                    hash=digest(text),
                    # The term's own definition, shown verbatim when a learner asks to translate it.
                    extra={
                        "termId": term["id"],
                        "definition": next(
                            (f["text"] for f in fields if f["field"] == "idio_def"), ""
                        ),
                    },
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
        embedder = OpenRouterEmbedder(settings, client, batch=16, patience=6)
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
    prepare(settings.content_dir, settings.index_dir)
    print(f"Index written to {settings.index_dir}: {json.dumps(meta.counts)}")


if __name__ == "__main__":
    asyncio.run(build())
