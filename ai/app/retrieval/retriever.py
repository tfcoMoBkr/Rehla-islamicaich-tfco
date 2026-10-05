"""Finds the passages an answer may rest on, for any language in app/languages.py.

1. Local hybrid search, first within the lessons in scope. A language with local books searches
   its own; any other language searches the Arabic and English index with the question and the
   classifier's search phrases, and keeps only the verses and hadiths found there.
2. Hadiths through the catalogue, ranked apart from the passages: when a hadith title matches
   well, the hadith itself is read (stored ones locally, the rest through MCP get_hadith).
3. Verses and hadiths are read in the answer's language: stored texts for Arabic and English,
   MCP get_quran_verses and get_hadith (with the Arabic alongside) for the others. A hadith with no
   version in that language comes with the fallback one, marked as such.
4. A quoted verse is looked up so its real wording can be shown (MCP search, then
   get_quran_verses); verses are never taken from model output or from a book's text.
5. Only when local results are weak: MCP search (keyword queries for local languages, the question
   itself for the others), then the best hadith and verse hits are read in full. Library hits
   carry no text and are ignored.
"""

import logging
import re
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field

import numpy as np

from app.index import Chunk, ChunkType, Index, opens_with_subheading
from app.index import Language as IndexLanguage
from app.languages import FALLBACK, Language, quran_translation, spec
from app.llm import Embedder
from app.retrieval.hybrid import Hit, fuse, search
from app.retrieval.mcp import ToolCaller
from app.retrieval.mcp_text import parse_hadith_versions, parse_search, parse_verses
from app.retrieval.passages import (
    Passage,
    from_chunk,
    from_hadith_chunks,
    from_mcp_hadith,
    from_mcp_verse,
)
from app.retrieval.terms import TermExpander
from app.text import has_arabic, words

log = logging.getLogger("rafiq.retrieval")

# Below this cosine similarity the best local passage is not taken to be about the question.
# Measured with bge-m3 on this corpus: related passages score 0.55-0.78, unrelated 0.33-0.50.
WEAK_COSINE = 0.50
MAX_PASSAGES = 10
LOCAL_PASSAGES = 7
# For a list question, the best LIST_SECTIONS book hits are read with the pieces around them
# that belong to the same list, at most LIST_RUN pieces each.
LIST_SECTIONS = 2
LIST_RUN = 3
CATALOGUE_HADITHS = 3
# Verses and hadiths read live for a language without local books.
LIVE_HADITHS = 3
LIVE_VERSES = 2
PASSAGE_TYPES: set[ChunkType] = {"book", "term", "quran", "hadith"}
# Other wordings of the question searched alongside it, from the classify step.
MAX_PHRASES = 2

KeywordMaker = Callable[[str, Language], Awaitable[list[str]]]


@dataclass
class Misquote:
    quoted: str
    ref: str
    exact: bool


@dataclass
class Retrieval:
    passages: list[Passage]
    weak: bool
    top_cosine: float
    misquote: Misquote | None = None
    mcp_calls: int = 0
    # A lesson beyond the learner's reach that covers the question.
    later_lesson: str | None = None
    notes: list[str] = field(default_factory=list)


def _later_lesson(hits: list[Hit], scope: list[str]) -> str | None:
    """The lesson that covers the best strong hit, when the learner has not reached it."""
    for hit in hits[:3]:
        if hit.cosine < WEAK_COSINE or not hit.chunk.lesson_ids:
            continue
        if set(hit.chunk.lesson_ids) & set(scope):
            return None
        return hit.chunk.lesson_ids[0]
    return None


def _same_section(piece: Chunk, other: Chunk) -> bool:
    return (
        other.type == "book"
        and other.lang == piece.lang
        and other.extra.get("book") == piece.extra.get("book")
        and other.extra.get("anchor") == piece.extra.get("anchor")
    )


def _contains(verse: str, quoted: str) -> bool:
    """Whether the quoted words appear, in order and together, in the verse."""
    verse_words, quoted_words = words(verse), words(quoted)
    if not quoted_words:
        return True
    return any(
        verse_words[start : start + len(quoted_words)] == quoted_words
        for start in range(len(verse_words) - len(quoted_words) + 1)
    )


def _index_languages(language: Language) -> list[IndexLanguage]:
    return [language] if spec(language).local else ["ar", "en"]  # type: ignore[list-item]


class Retriever:
    def __init__(self, index: Index, embedder: Embedder | None, mcp: ToolCaller) -> None:
        self._index = index
        self._embedder = embedder
        self._mcp = mcp
        self._terms = TermExpander(index)

    async def _vectors(self, queries: list[str]) -> list[np.ndarray | None]:
        if self._embedder is None:
            return [None] * len(queries)
        try:
            return list(await self._embedder.embed(queries))
        except Exception as error:
            log.warning("embedding unavailable (%s); BM25 only", type(error).__name__)
            return [None] * len(queries)

    def _stored_hadith(self, hadith_id: int, language: Language) -> Passage | None:
        def chunks_in(lang: str) -> list[Chunk]:
            return [
                chunk
                for chunk in self._index.chunks
                if chunk.type == "hadith"
                and chunk.lang == lang
                and chunk.extra.get("hadithId") == hadith_id
            ]

        own, arabic = chunks_in(language), chunks_in("ar")
        if not own or not arabic:
            return None
        return from_hadith_chunks(own, str(arabic[0].extra["hadith"]))

    async def _hadith(self, hadith_id: int, language: Language) -> Passage | None:
        stored = self._stored_hadith(hadith_id, language) if spec(language).local else None
        if stored:
            return stored
        wanted = list(dict.fromkeys(["ar", spec(language).hadeethenc, FALLBACK]))
        text = await self._mcp.call("get_hadith", {"id": hadith_id, "language": wanted})
        versions = parse_hadith_versions(hadith_id, text, wanted[0]) if text else {}
        return from_mcp_hadith(versions, language)

    async def _verse(self, surah: int, ayah: int, language: Language) -> Passage | None:
        if spec(language).local:
            stored = next(
                (
                    chunk
                    for chunk in self._index.chunks
                    if chunk.type == "quran"
                    and chunk.lang == language
                    and chunk.reference == f"{surah}:{ayah}"
                ),
                None,
            )
            if stored:
                return from_chunk(stored)
        translation = quran_translation(language)
        arguments: dict[str, object] = {"surah": surah, "ayah": ayah}
        arguments.update(
            {"translation_key": translation[1].key} if translation else {"language": "ar"}
        )
        text = await self._mcp.call("get_quran_verses", arguments)
        verses = parse_verses(text, with_translation=translation is not None) if text else []
        return from_mcp_verse(verses[0], language, translation) if verses else None

    def _ranked(
        self,
        queries: list[tuple[str, np.ndarray | None]],
        language: IndexLanguage,
        scope: list[str] | None,
        types: set[ChunkType],
        focus: str | None = None,
    ) -> tuple[list[Hit], str | None]:
        """Hits within the lessons in scope; all hits when those are weak, with the later lesson.
        Within the scope, the `focus` lesson is searched a second time on its own, so its passages
        rank first when they match."""

        def ranked(lesson_ids: list[str] | None) -> list[Hit]:
            searched = [lesson_ids]
            if lesson_ids and focus:
                searched.append([focus])
            return fuse(
                [
                    search(self._index, text, vector, language, lesson_ids=ids, types=types)
                    for ids in searched
                    for text, vector in queries
                ]
            )

        if scope:
            hits = ranked(scope)
            if hits and max(hit.cosine for hit in hits) >= WEAK_COSINE:
                return hits, None
        hits = ranked(None)
        return hits, _later_lesson(hits, scope) if scope else None

    def _list_run(self, chunk: Chunk) -> list[Chunk]:
        """The part of a book section a piece belongs to, in order: from the subheading that opens
        it ("They are six:") to the next one, at most LIST_RUN pieces. A list the chunk size cut
        runs on across these pieces. Pieces of a section are stored next to each other."""
        chunks = self._index.chunks
        hit = self._index.by_id[chunk.id]

        def continues(position: int) -> bool:
            """Whether the piece at `position` carries on the part before it."""
            return _same_section(chunk, chunks[position]) and not opens_with_subheading(
                chunks[position].text
            )

        start = hit
        while start > 0 and continues(start) and _same_section(chunk, chunks[start - 1]):
            start -= 1
        end = hit
        while end + 1 < len(chunks) and continues(end + 1):
            end += 1
        first = start if hit - start < LIST_RUN else hit - 1
        return chunks[first : min(end, first + LIST_RUN - 1) + 1]

    def _local_passages(
        self, hits: list[Hit], language: Language, *, list_question: bool = False
    ) -> list[Passage]:
        """The best local passages. For a list question the book pieces come first, the best ones
        with the rest of their list: a book gives the whole list, a hadith one item of it."""
        if list_question:
            hits = sorted(hits, key=lambda hit: hit.chunk.type != "book")
        passages: list[Passage] = []
        seen: set[str] = set()
        for rank, hit in enumerate(hits):
            chunk = hit.chunk
            if chunk.type == "hadith":
                hadith_id = int(str(chunk.extra["hadithId"]))
                if f"hadith:{hadith_id}" in seen:
                    continue
                seen.add(f"hadith:{hadith_id}")
                stored = self._stored_hadith(hadith_id, language)
                if stored:
                    passages.append(stored)
            else:
                whole = list_question and chunk.type == "book" and rank < LIST_SECTIONS
                run = self._list_run(chunk) if whole else [chunk]
                for piece in run:
                    if piece.id not in seen:
                        seen.add(piece.id)
                        passages.append(from_chunk(piece))
            if len(passages) >= LOCAL_PASSAGES:
                break
        return passages[:LOCAL_PASSAGES]

    async def _live_passages(self, hits: list[Hit], language: Language) -> list[Passage]:
        """For a language without local books: the verses and hadiths found, read in it."""
        hadith_ids: list[int] = []
        verse_refs: list[tuple[int, int]] = []
        for hit in hits:
            if hit.cosine < WEAK_COSINE:
                continue
            if hit.chunk.type == "hadith":
                hadith_ids.append(int(str(hit.chunk.extra["hadithId"])))
            elif hit.chunk.type == "quran":
                surah, ayah = (int(part) for part in hit.chunk.reference.split(":"))
                verse_refs.append((surah, ayah))
        passages: list[Passage] = []
        for surah, ayah in list(dict.fromkeys(verse_refs))[:LIVE_VERSES]:
            if verse := await self._verse(surah, ayah, language):
                passages.append(verse)
        for hadith_id in list(dict.fromkeys(hadith_ids))[:LIVE_HADITHS]:
            if hadith := await self._hadith(hadith_id, language):
                passages.append(hadith)
        return passages

    async def _search_mcp(self, query: str, language: Language) -> list[Passage]:
        text = await self._mcp.call(
            "search",
            {"query": query, "language": language, "sources": ["quran", "hadith"], "limit": 5},
        )
        passages: list[Passage] = []
        for hit in parse_search(text or "")[:2]:
            if hadith := re.fullmatch(r"hadith:(\d+):\w+", hit.id):
                passage = await self._hadith(int(hadith.group(1)), language)
            elif verse := re.fullmatch(r"quran:(\d+):(\d+)(?::\w+)?", hit.id):
                passage = await self._verse(int(verse.group(1)), int(verse.group(2)), language)
            else:
                continue
            if passage:
                passages.append(passage)
        return passages

    async def _quoted_verse(
        self, quote: str, language: Language
    ) -> tuple[Passage | None, Misquote | None]:
        text = await self._mcp.call(
            "search", {"query": quote, "language": "ar", "sources": ["quran"], "limit": 3}
        )
        for hit in parse_search(text or ""):
            verse = re.fullmatch(r"quran:(\d+):(\d+)(?::\w+)?", hit.id)
            if not verse:
                continue
            passage = await self._verse(int(verse.group(1)), int(verse.group(2)), language)
            if passage and passage.verse:
                return passage, Misquote(
                    quoted=quote,
                    ref=passage.verse.ref,
                    exact=_contains(passage.verse.arabic, quote),
                )
        return None, None

    async def _queries(
        self, question: str, phrases: list[str], language: IndexLanguage, own: bool
    ) -> list[tuple[str, np.ndarray | None]]:
        """The question (always: the embeddings are multilingual) and the phrases in `language`."""
        written_in = [p for p in phrases if has_arabic(p) == (language == "ar")]
        texts = [question, *(phrases if own else written_in)[:MAX_PHRASES]]
        if language == "en":
            texts = [self._terms.expand(text) for text in texts]
        return list(zip(texts, await self._vectors(texts), strict=True))

    async def retrieve(
        self,
        question: str,
        language: Language,
        *,
        scope: list[str] | None = None,
        phrases: list[str] | None = None,
        quoted_verse: str | None = None,
        keywords: KeywordMaker | None = None,
        list_question: bool = False,
        focus: str | None = None,
    ) -> Retrieval:
        """`phrases` are other wordings of the question, searched alongside it. A list question
        reads book sections first, each with the rest of its list. `focus` is the lesson being
        read: its own passages come first within the scope."""
        calls_before = self._mcp.calls
        local = spec(language).local
        passages: list[Passage] = []
        top_cosine = 0.0
        later_lesson = None
        catalogue_ids: list[int] = []
        for index_language in _index_languages(language):
            queries = await self._queries(question, phrases or [], index_language, local)
            hits, later = self._ranked(queries, index_language, scope, PASSAGE_TYPES, focus)
            # Catalogue titles only point to hadiths; ranked with passages, they crowd them out.
            catalogue, _ = self._ranked(queries, index_language, scope, {"catalogue"}, focus)
            top_cosine = max([top_cosine, *(hit.cosine for hit in [*hits, *catalogue])])
            later_lesson = later_lesson or later
            if local:
                passages.extend(self._local_passages(hits, language, list_question=list_question))
            else:
                passages.extend(await self._live_passages(hits, language))
            for hit in catalogue[:10]:
                # Only a hadith whose own title matches well is worth a call to the server.
                if hit.cosine >= WEAK_COSINE and "hadithId" in hit.chunk.extra:
                    catalogue_ids.append(int(str(hit.chunk.extra["hadithId"])))
        known = {passage.key for passage in passages}
        for hadith_id in list(dict.fromkeys(catalogue_ids))[:CATALOGUE_HADITHS]:
            if f"hadith:{hadith_id}" in known:
                continue
            if passage := await self._hadith(hadith_id, language):
                passages.append(passage)

        misquote = None
        if quoted_verse:
            verse, misquote = await self._quoted_verse(quoted_verse, language)
            if verse:
                passages.insert(0, verse)

        in_language = [p for p in passages if p.lang == language]
        weak = top_cosine < WEAK_COSINE or not in_language
        if weak:
            if local and keywords is not None:
                for query in (await keywords(question, language))[:2]:
                    passages.extend(await self._search_mcp(query, language))
            elif not local:
                passages.extend(await self._search_mcp(question, language))

        unique: dict[str, Passage] = {}
        for passage in passages:
            unique.setdefault(passage.key, passage)
        numbered = [
            passage.model_copy(update={"n": n})
            for n, passage in enumerate(list(unique.values())[:MAX_PASSAGES], 1)
        ]
        return Retrieval(
            passages=numbered,
            weak=weak,
            top_cosine=top_cosine,
            misquote=misquote,
            mcp_calls=self._mcp.calls - calls_before,
            later_lesson=later_lesson,
        )
