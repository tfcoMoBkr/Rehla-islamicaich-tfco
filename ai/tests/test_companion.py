"""Rafiq as a companion: conversation, warmth that carries no religious claim, care in hard moments,
danger caught before any model, and referral to specialists. Fake models only."""

import logging

import pytest

from app.rafiq.graph import Rafiq
from app.rafiq.schemas import ChatReply, Classification, Draft, Turn
from app.rafiq.specialists import referral_centres
from app.rafiq.warmth import screened
from app.retrieval import retriever as retriever_module
from app.retrieval.retriever import Retriever

from .fakes import WUDU, DownMcp, FakeChat, FakeEmbedder, chunk, index

GHUSL = chunk(
    id="book:ghusl:1",
    reference="Ghusl",
    text="Ghusl is washing the whole body with water, beginning with the parts washed in wudu.",
)
WARM = Draft(
    opening="That is a good thing to ask.",
    answer="You wash your face, your arms and your feet [1].",
    followUp="Was that clear?",
    adequate=True,
)


@pytest.fixture(autouse=True)
def low_threshold(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(retriever_module, "WEAK_COSINE", 0.2)


def classified(**fields: object) -> Classification:
    base: dict[str, object] = {"language": "en", "level": "A", "intent": "religious"}
    return Classification.model_validate({**base, **fields})


def rafiq(chat: FakeChat) -> Rafiq:
    return Rafiq(chat, Retriever(index(WUDU, GHUSL), FakeEmbedder(), DownMcp()))


async def test_a_follow_up_is_answered_as_the_question_it_stands_for() -> None:
    chat = FakeChat(classified(standalone="How is ghusl done?"), [WARM])
    history = [Turn(role="user", text="How do I perform wudu?"), Turn(role="assistant", text="…")]
    await rafiq(chat).run("And what about the other one?", "en", history=history)

    generated = next(user for user in chat.users if "Passages:" in user)
    assert "(It asks: How is ghusl done?)" in generated
    assert generated.index("Ghusl is washing") < generated.index("To perform wudu")


async def test_an_unclear_follow_up_gets_one_question_back() -> None:
    chat = FakeChat(classified(unclear=True, clarification="Do you mean wudu or ghusl?"), [WARM])
    answer = await rafiq(chat).run("And that one?", "en")

    assert answer.kind == "clarify"
    assert answer.opening == "Do you mean wudu or ghusl?"
    assert answer.sources == []
    assert not any("Passages:" in user for user in chat.users)


async def test_a_religious_claim_in_a_warm_line_is_removed_and_the_answer_still_shows() -> None:
    answer = await rafiq(FakeChat(classified(), [WARM], religious=["opening"])).run(
        "How do I perform wudu?", "en"
    )

    assert not answer.referred
    assert answer.opening is None
    assert answer.follow_up == "Was that clear?"
    assert answer.sources


async def test_thanks_alone_gets_a_warm_reply_without_sources_or_referral() -> None:
    chat = FakeChat(
        classified(intent="smalltalk"), [WARM], chat=ChatReply(opening="You are welcome.")
    )
    answer = await rafiq(chat).run("Thank you!", "en")

    assert answer.kind == "chat"
    assert answer.opening == "You are welcome."
    assert answer.sources == []
    assert not answer.referred
    assert answer.referral is not None
    assert answer.referral.centers == []


async def test_a_personal_case_gets_warmth_and_the_specialist_card() -> None:
    chat = FakeChat(classified(personalCase=True, level="D"), [WARM])
    answer = await rafiq(chat).run("My situation is complicated; what should I do?", "en")

    assert answer.referred
    assert answer.kind == "referral"
    assert answer.opening == "That is a good thing to ask."
    assert answer.referral is not None
    assert answer.referral.reason == "personalCase"
    assert answer.referral.centers == referral_centres()
    assert answer.referral.centers[0] == "moia-1933"


async def test_distress_is_met_with_care_and_the_specialist_card() -> None:
    care = Draft(opening="I am sorry it feels so heavy right now.", adequate=False)
    answer = await rafiq(FakeChat(classified(intent="distress"), [care])).run(
        "Since I converted my family will not speak to me.", "en"
    )

    assert answer.referral is not None
    assert answer.referral.reason == "distress"
    assert answer.referral.centers
    assert answer.opening == "I am sorry it feels so heavy right now."
    assert answer.sources == []


@pytest.mark.parametrize(
    "message",
    ["I want to end my life", "أريد أن أموت", "Je veux me tuer", "He hits me every night"],
)
async def test_danger_is_answered_before_any_model_is_asked(message: str) -> None:
    chat = FakeChat(classified(), [WARM])
    answer = await rafiq(chat).run(message, "en")

    assert answer.kind == "danger"
    assert answer.referral is not None
    assert answer.referral.reason == "danger"
    assert answer.referral.centers
    assert chat.systems == []


async def test_nothing_from_one_conversation_reaches_the_next() -> None:
    chat = FakeChat(classified(), [WARM])
    companion = rafiq(chat)
    detail = "My mother is not Muslim and I take medicine for my heart."
    first = await companion.run(f"{detail} How do I perform wudu?", "en")
    asked_before = len(chat.users)
    await companion.run("How do I perform wudu?", "en")

    assert not any(detail in user for user in chat.users[asked_before:])
    assert detail not in first.model_dump_json()


async def test_logs_carry_no_words_of_the_conversation(caplog: pytest.LogCaptureFixture) -> None:
    caplog.set_level(logging.INFO, logger="rafiq")
    message = "Thank you, Rafiq, my friend Yusuf told me about you."
    await rafiq(FakeChat(classified(intent="smalltalk"), [WARM])).run(message, "en")

    assert "Yusuf" not in caplog.text
    assert "kind=chat" in caplog.text


def test_a_warm_line_in_another_language_is_dropped() -> None:
    lines = {
        "opening": "It is good that you are asking about this.",
        "followUp": "هل اتضح لك ذلك الآن، أم نزيده تفصيلًا؟",
    }

    assert screened(lines, [], "ar") == {"followUp": lines["followUp"]}


def test_a_warm_line_already_said_in_the_conversation_is_dropped() -> None:
    earlier = "That is a good thing to ask.\nYou wash your face [1].\nWould you like to know more?"
    lines = {
        "opening": "I understand why this matters.",
        "followUp": "Would you like to know more?",
    }

    assert screened(lines, [], "en", earlier) == {"opening": lines["opening"]}


async def test_under_the_ruling_guard_the_check_also_removes_stated_rulings() -> None:
    guarded = FakeChat(classified(personalCase=True, level="D"), [WARM])
    await rafiq(guarded).run("My situation is complicated; what should I do?", "en")
    plain = FakeChat(classified(), [WARM])
    await rafiq(plain).run("How do I perform wudu?", "en")

    assert any("states a ruling" in system for system in guarded.systems)
    assert not any("states a ruling" in system for system in plain.systems)
