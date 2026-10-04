"""Hybrid search over the local index: cosine and BM25, merged by reciprocal rank fusion."""

from dataclasses import dataclass

import numpy as np

from app.index import Chunk, ChunkType, Index, Language
from app.text import tokens

RRF_K = 60


@dataclass(frozen=True)
class Hit:
    chunk: Chunk
    cosine: float
    score: float


def search(
    index: Index,
    query: str,
    vector: np.ndarray | None,
    language: Language,
    *,
    k: int = 20,
    lesson_ids: list[str] | None = None,
    types: set[ChunkType] | None = None,
) -> list[Hit]:
    """The k best chunks in `language`, optionally only those of `lesson_ids` or `types`."""
    scope = set(lesson_ids or [])
    candidates = np.array(
        [
            position
            for position, chunk in enumerate(index.chunks)
            if chunk.lang == language
            and (types is None or chunk.type in types)
            and (not scope or scope & set(chunk.lesson_ids))
        ],
        dtype=np.int64,
    )
    if candidates.size == 0:
        return []

    fused = np.zeros(candidates.size, dtype=np.float64)
    cosines = np.zeros(candidates.size, dtype=np.float32)
    if vector is not None:
        cosines = index.vectors[candidates] @ vector.astype(np.float32)
        for rank, position in enumerate(np.argsort(-cosines)):
            fused[position] += 1 / (RRF_K + rank + 1)
    lexical = index.bm25.scores(tokens(query))[candidates]
    for rank, position in enumerate(np.argsort(-lexical)):
        if lexical[position] <= 0:
            break
        fused[position] += 1 / (RRF_K + rank + 1)

    best = np.argsort(-fused)[:k]
    return [
        Hit(
            chunk=index.chunks[candidates[position]],
            cosine=float(cosines[position]),
            score=float(fused[position]),
        )
        for position in best
        if fused[position] > 0
    ]


def fuse(rankings: list[list[Hit]], k: int = 20) -> list[Hit]:
    """Rankings for several wordings of one question, merged by reciprocal rank fusion.

    A chunk keeps the best cosine it reached under any wording."""
    if len(rankings) == 1:
        return rankings[0]
    best: dict[str, Hit] = {}
    scores: dict[str, float] = {}
    for ranking in rankings:
        for rank, hit in enumerate(ranking):
            key = hit.chunk.id
            scores[key] = scores.get(key, 0.0) + 1 / (RRF_K + rank + 1)
            if key not in best or hit.cosine > best[key].cosine:
                best[key] = hit
    order = sorted(scores, key=lambda key: scores[key], reverse=True)[:k]
    return [Hit(chunk=best[key].chunk, cosine=best[key].cosine, score=scores[key]) for key in order]
