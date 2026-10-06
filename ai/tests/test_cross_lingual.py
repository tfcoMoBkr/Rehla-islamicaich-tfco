"""Retrieval is cross-lingual for every language: the Arabic search phrase searches the Arabic
index and the English one the English index, whatever the question's language; each language is
then answered in the mode it already has. The texts are placeholders, not religious content."""

import pytest

from app.index import Chunk
from app.languages import Language
from app.retrieval import retriever as retriever_module
from app.retrieval.retriever import Retriever

from .fakes import FakeEmbedder, ScriptedMcp, chunk, index

PHRASES = ["عدد ركعات كل صلاة", "number of rak'ahs in each prayer"]
ARABIC_BOOK = chunk(
    id="book:ar:1",
    lang="ar",
    sourceId="ih-almukhtasar-almufid",
    title="كتاب",
    reference="الصلاة",
    text="عدد ركعات كل صلاة من الصلوات الخمس في هذا الموضع من الكتاب.",
)


def stored_hadith(lang: str, text: str) -> Chunk:
    return chunk(
        id=f"hadith:99:{lang}:text",
        lang=lang,
        type="hadith",
        sourceId="hadeethenc",
        title="Narration 99",
        reference="#99",
        url=f"https://hadeethenc.com/{lang}/browse/hadith/99",
        publisher="HadeethEnc.com",
        text=text,
        extra={
            "hadithId": 99,
            "part": "text",
            "hadith": text,
            "grade": "Graded",
            "attribution": "Recorded",
        },
    )


HADITH_AR = stored_hadith("ar", "نص عن عدد ركعات كل صلاة")
HADITH_EN = stored_hadith("en", "A text on the number of rak'ahs in each prayer")
QUESTIONS: dict[str, tuple[str, Language]] = {
    # The question as written, and the language it is answered in (ru and id fall back to English).
    "ar": ("كم عدد ركعات كل صلاة؟", "ar"),
    "fr": ("Combien de rak'ahs dans chaque prière ?", "fr"),
    "ur": ("ہر نماز میں کتنی رکعتیں ہیں؟", "ur"),
    "ru": ("Сколько ракаатов в каждой молитве?", "en"),
    "id": ("Berapa rakaat dalam setiap shalat?", "en"),
}


@pytest.fixture(autouse=True)
def low_threshold(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(retriever_module, "WEAK_COSINE", 0.0)


@pytest.mark.parametrize("asked", list(QUESTIONS))
async def test_the_rakah_question_reaches_the_same_passage_in_every_language(asked: str) -> None:
    question, language = QUESTIONS[asked]
    mcp = ScriptedMcp({})
    retriever = Retriever(index(ARABIC_BOOK, HADITH_AR, HADITH_EN), FakeEmbedder(), mcp)
    found = await retriever.retrieve(question, language, phrases=PHRASES)

    keys = {passage.key for passage in found.passages}
    if language in ("ar", "en"):
        # Answered from the passages: the Arabic book is read whatever the question's language,
        # and the hadith in the answer's own language.
        assert any(passage.source_id == "ih-almukhtasar-almufid" for passage in found.passages)
        assert "hadith:99" in keys
        assert next(p for p in found.passages if p.key == "hadith:99").lang == language
    else:
        # Answered extractively: the same hadith, read from the approved source in that language.
        asked_for = [args.get("id") for args in mcp.arguments if "id" in args]
        assert 99 in asked_for


async def test_an_english_question_reads_its_own_books_before_the_other_language() -> None:
    english = chunk(id="book:en:1", text="The number of rak'ahs in each prayer, as the book says.")
    retriever = Retriever(index(english, ARABIC_BOOK), FakeEmbedder(), ScriptedMcp({}))
    found = await retriever.retrieve("How many rak'ahs?", "en", phrases=PHRASES)
    assert [passage.lang for passage in found.passages][:2] == ["en", "ar"]
