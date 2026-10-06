"""List questions against the real index (ai/data/index): the book section that holds the list is
read first, in Arabic and English.

No query is embedded: the retriever has no embedder, so only BM25, the lesson filter and the
ranking are exercised, and nothing reaches OpenRouter. Without cosine scores every local hit would
count as weak and the learner's scope would be dropped, so the weak threshold is set to 0 here, as
a strong local match would.
"""

from pathlib import Path

import pytest

from app.index import Index
from app.languages import Language
from app.retrieval import retriever as retriever_module
from app.retrieval.retriever import Retriever

from .fakes import DownMcp

INDEX = Path(__file__).resolve().parents[1] / "data" / "index"
TOP = 3

pytestmark = pytest.mark.skipif(
    not (INDEX / "chunks.jsonl").exists(), reason="ai/data/index is not built"
)


@pytest.fixture(scope="module")
def real_index() -> Index:
    return Index.load(INDEX)


@pytest.fixture(autouse=True)
def lexical_only(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(retriever_module, "WEAK_COSINE", 0.0)


def reached_through(index: Index, lesson: str) -> list[str]:
    """The lessons a learner has reached when they are at `lesson`, in the road's order."""
    lessons = sorted({id_ for chunk in index.chunks for id_ in chunk.lesson_ids})
    return lessons[: lessons.index(lesson) + 1]


@pytest.mark.parametrize(
    ("question", "language", "lesson", "list_chunk"),
    [
        ("What breaks wudu?", "en", "2.3", "book:2842316:s17:1"),
        ("ما نواقض الوضوء؟", "ar", "2.3", "book:1871:t18:1"),
        ("What are the conditions of prayer?", "en", "3.2", "book:2842316:s9:1"),
        ("ما شروط الصلاة؟", "ar", "3.2", "book:1871:t10:1"),
        ("What are the pillars of Islam?", "en", "1.4", "book:byenah-4784:s6:2"),
        ("ما أركان الإسلام؟", "ar", "1.4", "book:islamhouse-2831443:s5:1"),
    ],
)
async def test_a_list_question_reads_the_section_that_holds_the_list(
    real_index: Index, question: str, language: Language, lesson: str, list_chunk: str
) -> None:
    retriever = Retriever(real_index, None, DownMcp())
    held = real_index.chunks[real_index.by_id[list_chunk]]

    result = await retriever.retrieve(
        question, language, scope=reached_through(real_index, lesson), list_question=True
    )

    texts = [passage.text for passage in result.passages]
    assert held.text in texts[:TOP]
    position = texts.index(held.text)
    assert not any(passage.sacred for passage in result.passages[:position])
    # The passage names its section, so the model and the check can see what the list is about.
    heading = str(held.extra["heading"]).rstrip(" :")
    assert result.passages[position].reference.startswith(heading)
