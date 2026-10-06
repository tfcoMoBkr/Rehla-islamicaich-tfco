"""A question-and-answer book in the corpus: one chunk per question (its question and the book's
summary answer), verses in a glyph font left out, and an index build that waits out a rate limit
instead of failing. The texts below are placeholders, not the book's."""

import importlib.util
import json

import httpx
import pytest

from app import llm
from app.config import REPOSITORY_ROOT, Settings
from app.ingest import question_chunk, without_glyph_verses
from app.llm import OpenRouterEmbedder

SECTION = {
    "book": "dawa-1",
    "language": "ar",
    "anchor": "q7",
    "heading": "عنوان المسألة؟",
    "paragraphs": [
        {"index": 1, "part": "question", "text": "نص السؤال كما في الكتاب؟"},
        {"index": 2, "part": "similar", "text": "صيغة أخرى للسؤال."},
        {"index": 3, "part": "summary", "text": "مختصر الجواب: ﴿ ﴾ ]40[ ثم بقيته."},
        {"index": 4, "part": "detail", "text": "الجواب التفصيلي الطويل."},
    ],
    "source": {"publisher": "dawa.center", "url": "https://dawa.center/file/1"},
}
BOOK = {"id": "dawa-7937", "language": "ar", "title": "عنوان الكتاب"}


def test_a_question_is_one_chunk_of_its_question_and_summary_answer() -> None:
    chunk = question_chunk(BOOK, SECTION, ["1.2"])
    assert chunk.id == "book:dawa-7937:q7:1"
    assert chunk.reference == "عنوان المسألة؟"
    assert chunk.text == "نص السؤال كما في الكتاب؟\n\nمختصر الجواب: ]40[ ثم بقيته."
    assert "صيغة أخرى" not in chunk.text
    assert "التفصيلي" not in chunk.text
    assert (chunk.source_id, chunk.lesson_ids) == ("dawa-bayyinat", ["1.2"])


def test_verses_in_a_glyph_font_are_left_out_of_the_text() -> None:
    assert without_glyph_verses("قال: ﴿ ﴾ وبعدُ") == "قال: وبعدُ"
    assert without_glyph_verses("نص بلا آيات") == "نص بلا آيات"


class RateLimited(httpx.AsyncBaseTransport):
    def __init__(self, limited: int) -> None:
        self.limited = limited
        self.calls = 0

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        self.calls += 1
        if self.calls <= self.limited:
            return httpx.Response(429, headers={"retry-after": "0"})
        size = len(json.loads(request.content)["input"])
        rows = [{"index": i, "embedding": [1.0, 0.0]} for i in range(size)]
        return httpx.Response(200, json={"data": rows})


@pytest.mark.parametrize(("patience", "succeeds"), [(0, False), (2, True)])
async def test_the_index_build_waits_out_a_rate_limit_but_a_question_does_not(
    patience: int, succeeds: bool, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(llm, "RATE_LIMIT_WAIT", 0.0)
    settings = Settings(OPENROUTER_API_KEY="k", EMBEDDING_MODEL="m", _env_file=None)
    transport = RateLimited(limited=2)
    async with httpx.AsyncClient(transport=transport) as client:
        embedder = OpenRouterEmbedder(settings, client, batch=2, patience=patience)
        if succeeds:
            assert (await embedder.embed(["a", "b", "c"])).shape == (3, 2)
        else:
            with pytest.raises(httpx.HTTPStatusError):
                await embedder.embed(["a"])


def test_the_book_is_split_at_its_numbered_questions_and_labelled_parts() -> None:
    script = REPOSITORY_ROOT / "scripts" / "sources" / "qa_sections.py"
    spec = importlib.util.spec_from_file_location("qa_sections", script)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    page = (
        "12\nعنوان الكتاب - فرعي\nالم7سعنوان المسألة؟\nالسؤال\nنص السؤال؟\nمختصَرم ا جاإة:\nالجواب."
    )
    assert module.body_lines(page, "عنوان الكتاب - فرعي") == page.split("\n")[2:]
    assert module.label_of("مختصَرم ا جاإة:") == "summary"
    assert module.label_of("الجوابم التفصيليّ:") == "detail"
    assert module.label_of("عبارات مشاإهة لل)ؤال") == "similar"
    assert module.QUESTION.match("الم105سهل المعجزات ممكنة؟").groups() == (
        "105",
        "هل المعجزات ممكنة؟",
    )
