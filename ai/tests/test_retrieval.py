"""Local retrieval: other wordings of a question, and transliterated terms."""

from dataclasses import replace

import pytest

from app import languages
from app.retrieval.retriever import Retriever
from app.retrieval.terms import TermExpander

from .fakes import WUDU, DownMcp, FakeEmbedder, ScriptedMcp, chunk, index

NULLIFIERS = chunk(
    id="book:wudu:2",
    text="Ablution gets invalidated by the following: what comes out of the two passages.",
)


async def test_a_search_phrase_finds_what_the_question_words_miss() -> None:
    retriever = Retriever(index(WUDU, NULLIFIERS), FakeEmbedder(), DownMcp())

    result = await retriever.retrieve(
        "What breaks it?", "en", phrases=["what invalidates ablution", "ablution invalidated"]
    )

    assert result.passages[0].text == NULLIFIERS.text


def test_a_transliterated_term_gains_its_english_name_from_the_stored_terms() -> None:
    term = chunk(
        id="term:6733:en",
        type="term",
        sourceId="terminologyenc",
        text='Ablution\nBrief explanation: "Wudū’" (ablution) is to use pure water.',
    )
    expander = TermExpander(index(term))

    assert expander.expand("What breaks wudu?") == "What breaks wudu? (ablution)"
    assert expander.expand("What breaks ablution?") == "What breaks ablution?"


ENGLISH_VERSE = """──────── RETRIEVED FROM QURANENC — published text ────────

[EXACT] the verses and their published translation
[2:256]
ARABIC WORDS
English words of the published translation.
[/EXACT]

Source: https://quranenc.com/en/browse/english_saheeh/2#256
"""

ARABIC_AND_ENGLISH_HADITH = """──────── RETRIEVED FROM HADEETHENC — published text ────────

[ar — العربية]
عنوان

[EXACT] the narration itself
النص العربي المنشور
[/EXACT]

Source: https://hadeethenc.com/ar/browse/hadith/42

────────

[en — English]
Title

[EXACT] the narration itself
The published English text.
[/EXACT]

Source: https://hadeethenc.com/en/browse/hadith/42
"""


async def test_a_verse_with_no_translation_in_the_language_carries_the_fallback_labelled(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Every language in the table has a QuranEnc translation today; take one away.
    monkeypatch.setitem(languages.LANGUAGES, "bn", replace(languages.LANGUAGES["bn"], quran=None))
    mcp = ScriptedMcp({"get_quran_verses": ENGLISH_VERSE})
    retriever = Retriever(index(WUDU), FakeEmbedder(), mcp)

    passage = await retriever._verse(2, 256, "bn")

    assert passage is not None
    assert passage.verse is not None
    assert passage.lang == "en"
    assert (passage.verse.translation_language, passage.verse.translation_key) == (
        "en",
        "english_saheeh",
    )
    assert mcp.arguments == [{"surah": 2, "ayah": 256, "translation_key": "english_saheeh"}]


async def test_a_hadith_with_no_version_in_the_language_comes_in_the_fallback() -> None:
    mcp = ScriptedMcp({"get_hadith": ARABIC_AND_ENGLISH_HADITH})
    retriever = Retriever(index(WUDU), FakeEmbedder(), mcp)

    passage = await retriever._hadith(42, "bn")

    assert passage is not None
    assert passage.hadith is not None
    assert passage.lang == "en"
    assert passage.hadith.arabic == "النص العربي المنشور"
    assert (passage.hadith.text, passage.hadith.text_language) == (
        "The published English text.",
        "en",
    )
    assert mcp.arguments == [{"id": 42, "language": ["ar", "bn", "en"]}]
