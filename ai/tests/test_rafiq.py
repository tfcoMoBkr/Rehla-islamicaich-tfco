"""Rafiq's pipeline with a fake model, fake embeddings and an unreachable MCP server."""

import logging

import pytest

from app.languages import Language
from app.rafiq.graph import Rafiq
from app.rafiq.schemas import Classification, Draft, Level, QuranBlock, RafiqAnswer, TextBlock
from app.retrieval import retriever as retriever_module
from app.retrieval.retriever import Retrieval, Retriever

from .fakes import VERSE, WUDU, DownMcp, FakeChat, FakeEmbedder, ScriptedMcp, index

QUESTION = "How do I perform wudu?"
GOOD = Draft(answer="You wash your face, your arms and your feet [1].", adequate=True)


@pytest.fixture(autouse=True)
def low_threshold(monkeypatch: pytest.MonkeyPatch) -> None:
    # Bag-of-words vectors are less alike than real embeddings; a local hit still counts as strong.
    monkeypatch.setattr(retriever_module, "WEAK_COSINE", 0.2)


def reason(answer: RafiqAnswer) -> str | None:
    return answer.referral.reason if answer.referral else None


def classified(level: Level = "A", **fields: object) -> Classification:
    return Classification.model_validate(
        {"language": "en", "level": level, "intent": "religious", **fields}
    )


def rafiq(chat: FakeChat, mcp: DownMcp | None = None) -> Rafiq:
    return Rafiq(chat, Retriever(index(WUDU, VERSE), FakeEmbedder(), mcp or DownMcp()))


@pytest.mark.parametrize("level", ["A", "B"])
async def test_levels_a_and_b_are_answered_with_their_sources(level: Level) -> None:
    answer = await rafiq(FakeChat(classified(level), [GOOD])).run(QUESTION, "en")

    assert not answer.referred
    assert answer.level == level
    assert answer.sources[0].url == WUDU.url


async def test_level_c_answers_under_the_disputed_rule_and_refers() -> None:
    chat = FakeChat(classified("C"), [GOOD])
    answer = await rafiq(chat).run(QUESTION, "en")

    assert any("Scholars may differ" in system for system in chat.systems)
    assert answer.sources[0].url == WUDU.url
    assert answer.referred
    assert reason(answer) == "disputed"


async def test_level_c_without_an_adequate_source_is_referred() -> None:
    answer = await rafiq(FakeChat(classified("C"), [Draft(adequate=False)])).run(QUESTION, "en")

    assert answer.referred
    assert reason(answer) == "disputed"


@pytest.mark.parametrize(
    ("classification", "expected"),
    [(classified("D"), "fatwa"), (classified("B", personalCase=True), "personalCase")],
)
async def test_a_ruling_is_never_given_for_level_d_or_a_personal_case(
    classification: Classification, expected: str
) -> None:
    chat = FakeChat(classification, [GOOD])
    answer = await rafiq(chat).run(QUESTION, "en")

    assert answer.referred
    assert reason(answer) == expected
    # The model was told to give general information only.
    assert any("Do not state any ruling" in system for system in chat.systems)


async def test_level_d_without_general_information_is_still_referred() -> None:
    answer = await rafiq(FakeChat(classified("D"), [Draft(adequate=False)])).run(QUESTION, "en")

    assert answer.referred
    assert answer.blocks == []
    assert reason(answer) == "fatwa"


async def test_no_adequate_source_refers() -> None:
    answer = await rafiq(FakeChat(classified("A"), [Draft(adequate=False)])).run(QUESTION, "en")

    assert answer.referred
    assert answer.sources == []
    assert reason(answer) == "noSource"


async def test_proof_that_no_passage_gives_is_reported_not_invented() -> None:
    chat = FakeChat(
        classified("A", asksForEvidence=True),
        [Draft(answer="x [1].", adequate=True, evidenceFound=False)],
    )
    answer = await rafiq(chat).run("Give me a hadith proving that coffee is recommended.", "en")

    assert reason(answer) == "noEvidence"
    assert answer.blocks == []


@pytest.mark.parametrize(
    ("intent", "expected", "referred"),
    [("offtopic", "offTopic", True), ("smalltalk", "smalltalk", False)],
)
async def test_off_topic_and_small_talk_need_no_sources(
    intent: str, expected: str, referred: bool
) -> None:
    chat = FakeChat(classified("A", intent=intent), [GOOD])
    answer = await rafiq(chat).run("What is the weather today?", "en")

    assert reason(answer) == expected
    assert answer.referred is referred
    assert answer.sources == []
    assert not any("numbered passages" in system for system in chat.systems)  # nothing generated


async def test_an_answer_that_fails_verification_twice_is_referred() -> None:
    uncited = Draft(answer="You wash your face, your arms and your feet.", adequate=True)
    answer = await rafiq(FakeChat(classified("A"), [uncited])).run(QUESTION, "en")

    assert reason(answer) == "verification"


async def test_a_failed_check_is_retried_once_with_the_problems() -> None:
    uncited = Draft(answer="You wash your face, your arms and your feet.", adequate=True)
    chat = FakeChat(classified("A"), [uncited, GOOD])
    answer = await rafiq(chat).run(QUESTION, "en")

    assert not answer.referred
    assert "no source marker" in chat.users[-2]


async def test_unsupported_sentences_fail_the_model_check() -> None:
    answer = await rafiq(FakeChat(classified("A"), [GOOD], unsupported=[1])).run(QUESTION, "en")

    assert reason(answer) == "verification"


async def test_mcp_down_still_answers_from_local_sources() -> None:
    mcp = DownMcp()
    answer = await rafiq(FakeChat(classified("A"), [GOOD]), mcp).run(QUESTION, "en")

    assert not answer.referred
    assert answer.sources
    assert answer.sources[0].url == WUDU.url


async def test_a_topic_from_a_later_lesson_names_that_lesson() -> None:
    later = WUDU.model_copy(update={"lesson_ids": ["2.1"]})
    retriever = Retriever(index(later, VERSE), FakeEmbedder(), DownMcp())
    answer = await Rafiq(FakeChat(classified("A"), [GOOD]), retriever).run(
        QUESTION, "en", scope=["1.1"]
    )

    assert answer.later_lesson_id == "2.1"


async def test_a_topic_within_reach_names_no_later_lesson() -> None:
    reached = WUDU.model_copy(update={"lesson_ids": ["1.1"]})
    retriever = Retriever(index(reached, VERSE), FakeEmbedder(), DownMcp())
    answer = await Rafiq(FakeChat(classified("A"), [GOOD]), retriever).run(
        QUESTION, "en", scope=["1.1"]
    )

    assert answer.later_lesson_id is None


async def test_a_retry_that_still_has_an_uncited_sentence_is_repaired_not_referred() -> None:
    draft = Draft(
        answer="You wash your face and your feet [1].\n\nThis line has no source at all.",
        adequate=True,
    )
    answer = await rafiq(FakeChat(classified("A"), [draft])).run(QUESTION, "en")

    assert not answer.referred
    text = " ".join(block.text for block in answer.blocks if isinstance(block, TextBlock))
    assert "no source" not in text


async def test_markers_in_any_common_style_pass_the_first_time() -> None:
    draft = Draft(answer="You wash your face [1, 2]. Then your feet [١].", adequate=True)
    chat = FakeChat(classified("A"), [draft])
    answer = await rafiq(chat).run(QUESTION, "en")

    assert not answer.referred
    assert chat.users[-1].startswith("Sentence 1")  # the support check, not a second draft


async def test_without_the_debug_switch_logs_carry_no_text(
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.INFO, logger="rafiq")
    secret = "This line has no source at all, and it is private."
    draft = Draft(
        answer=f"You wash your face, your arms and your feet [1].\n\n{secret}", adequate=True
    )
    await rafiq(FakeChat(classified("A"), [draft])).run(QUESTION, "en")

    assert "problems={'unmarked': 1}" in caplog.text
    assert secret not in caplog.text
    assert QUESTION not in caplog.text


async def test_the_debug_switch_logs_drafts(caplog: pytest.LogCaptureFixture) -> None:
    caplog.set_level(logging.INFO, logger="rafiq")
    retriever = Retriever(index(WUDU, VERSE), FakeEmbedder(), DownMcp())
    await Rafiq(FakeChat(classified("A"), [GOOD]), retriever, debug=True).run(QUESTION, "en")

    assert GOOD.answer in caplog.text


URDU_VERSE = """──────── RETRIEVED FROM QURANENC — published text ────────

[Surah 2, translation "urdu_junagarhi"]

[EXACT] the verses and their published translation
[2:256]
عربی آیت کے الفاظ
اردو ترجمے کے شائع شدہ الفاظ
[/EXACT]

Source: https://quranenc.com/ur/browse/urdu_junagarhi/2#256
"""


async def test_an_urdu_question_is_answered_from_texts_published_in_urdu() -> None:
    mcp = ScriptedMcp({"get_quran_verses": URDU_VERSE})
    chat = FakeChat(
        classified("A", language="ur", searchPhrases=["no compulsion in the religion"]),
        [Draft(answer="یہ آیت اس سوال کے بارے میں ہے [1]۔", adequate=True)],
    )
    answer = await rafiq(chat, mcp).run("دین میں زبردستی کے بارے میں کیا ہے؟", "en")

    assert not answer.referred
    assert answer.language == "ur"
    block = next(b for b in answer.blocks if isinstance(b, QuranBlock))
    assert block.translation == "اردو ترجمے کے شائع شدہ الفاظ"
    assert (block.translation_language, block.translation_key) == ("ur", "urdu_junagarhi")
    assert {"surah": 2, "ayah": 256, "translation_key": "urdu_junagarhi"} in mcp.arguments


async def test_nothing_published_in_the_language_is_referred() -> None:
    chat = FakeChat(
        classified("A", language="fr", searchPhrases=["no compulsion in the religion"]), [GOOD]
    )
    answer = await rafiq(chat).run("Quelle est la question ?", "en")

    assert answer.referred
    assert reason(answer) == "noSource"
    assert answer.language == "fr"


async def test_a_language_rafiq_does_not_answer_in_gets_english() -> None:
    answer = await rafiq(FakeChat(classified("A", language="other"), [GOOD])).run(QUESTION, "en")

    assert answer.language == "en"
    assert answer.language_fallback


async def test_the_support_check_reads_where_a_book_passage_sits() -> None:
    chat = FakeChat(classified("A"), [GOOD])
    await rafiq(chat).run(QUESTION, "en")

    check = next(user for user in chat.users if user.startswith("Sentence 1:"))
    assert f"[1] ({WUDU.reference}) {WUDU.text}" in check


class RecordingRetriever(Retriever):
    def __init__(self) -> None:
        super().__init__(index(WUDU, VERSE), FakeEmbedder(), DownMcp())
        self.list_questions: list[bool] = []

    async def retrieve(
        self, question: str, language: Language, *, list_question: bool = False, **options: object
    ) -> Retrieval:
        self.list_questions.append(list_question)
        return await super().retrieve(question, language, list_question=list_question, **options)  # type: ignore[arg-type]


async def test_a_list_question_is_retrieved_as_a_list() -> None:
    retriever = RecordingRetriever()
    chat = FakeChat(classified("A", questionType="list"), [GOOD])
    await Rafiq(chat, retriever).run("What are the steps of wudu?", "en")

    assert retriever.list_questions == [True]
