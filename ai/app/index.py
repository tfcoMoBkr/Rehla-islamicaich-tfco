"""Rafiq's local index (ai/data/index/): chunks with their metadata, their vectors, and BM25.

chunks.jsonl holds one chunk per line; vectors.npy the matching unit vectors as float16; meta.json
the embedding model and counts. Built by `uv run python -m app.ingest`.
"""

import json
import math
from collections import Counter
from pathlib import Path
from typing import Literal

import numpy as np
from pydantic import BaseModel, ConfigDict, Field

from app.text import tokens

Language = Literal["ar", "en"]
SUBHEADING = 90
ChunkType = Literal["book", "hadith", "quran", "term", "catalogue"]


class Chunk(BaseModel):
    """One searchable piece of a source, with what is needed to cite it."""

    model_config = ConfigDict(populate_by_name=True, frozen=True)

    id: str
    lang: Language
    type: ChunkType
    source_id: str = Field(alias="sourceId")
    title: str
    reference: str
    url: str
    publisher: str
    lesson_ids: list[str] = Field(default_factory=list, alias="lessonIds")
    text: str
    hash: str
    # Type-specific data: hadithId, surah/ayah, part, grade, attribution, heading, categoryIds…
    extra: dict[str, object] = Field(default_factory=dict)


def is_subheading(paragraph: str) -> bool:
    """A short line that introduces what follows, such as "When ablution is due:"."""
    return len(paragraph) <= SUBHEADING and paragraph.rstrip().endswith(":")


def opens_with_subheading(text: str) -> bool:
    return is_subheading(text.split("\n\n", 1)[0])


def searchable(chunk: Chunk) -> str:
    """What BM25 reads: the title, a book piece's section heading, and the text. A piece that
    opens with its own subheading ("They are six:") names its subject only in the heading."""
    heading = str(chunk.extra.get("heading") or "") if chunk.type == "book" else ""
    return " ".join(part for part in (chunk.title, heading, chunk.text) if part)


class IndexMeta(BaseModel):
    embedding_model: str = Field(alias="embeddingModel")
    dimensions: int
    chunks: int
    built_on: str = Field(alias="builtOn")
    counts: dict[str, int]


class Bm25:
    """Okapi BM25 over pre-tokenised documents (Arabic normalised, see app.text)."""

    def __init__(self, documents: list[list[str]], k1: float = 1.5, b: float = 0.75) -> None:
        self._k1, self._b = k1, b
        self._size = len(documents)
        lengths = np.array([len(document) for document in documents], dtype=np.float32)
        average = float(lengths.mean()) if documents else 1.0
        self._norms = k1 * (1 - b + b * lengths / max(average, 1.0))
        self._postings: dict[str, list[tuple[int, int]]] = {}
        for position, document in enumerate(documents):
            for term, count in Counter(document).items():
                self._postings.setdefault(term, []).append((position, count))
        self._idf = {
            term: math.log(1 + (self._size - len(postings) + 0.5) / (len(postings) + 0.5))
            for term, postings in self._postings.items()
        }

    def scores(self, query: list[str]) -> np.ndarray:
        result = np.zeros(self._size, dtype=np.float32)
        for term in set(query):
            for position, count in self._postings.get(term, []):
                result[position] += (
                    self._idf[term] * count * (self._k1 + 1) / (count + self._norms[position])
                )
        return result


class Index:
    def __init__(
        self, chunks: list[Chunk], vectors: np.ndarray, meta: IndexMeta | None = None
    ) -> None:
        if len(chunks) != len(vectors):
            raise ValueError("chunks and vectors differ in length")
        self.chunks = chunks
        self.vectors = vectors.astype(np.float32)
        self.meta = meta
        self.bm25 = Bm25([tokens(searchable(chunk)) for chunk in chunks])
        self.by_id = {chunk.id: position for position, chunk in enumerate(chunks)}

    @classmethod
    def load(cls, directory: Path) -> "Index":
        chunks = [
            Chunk.model_validate_json(line)
            for line in (directory / "chunks.jsonl").read_text(encoding="utf-8").splitlines()
            if line.strip()
        ]
        vectors = np.load(directory / "vectors.npy")
        meta = IndexMeta.model_validate_json((directory / "meta.json").read_text(encoding="utf-8"))
        return cls(chunks, vectors, meta)

    def save(self, directory: Path, meta: IndexMeta) -> None:
        directory.mkdir(parents=True, exist_ok=True)
        with (directory / "chunks.jsonl").open("w", encoding="utf-8", newline="\n") as file:
            for chunk in self.chunks:
                file.write(chunk.model_dump_json(by_alias=True) + "\n")
        np.save(directory / "vectors.npy", self.vectors.astype(np.float16))
        (directory / "meta.json").write_text(
            json.dumps(meta.model_dump(by_alias=True), ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
