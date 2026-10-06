"""The learner's name: Rafiq writes only the placeholder {{name}}, in warm lines, now and then; the
name itself never reaches the service. Fake models only."""

import pytest

from app.rafiq.graph import NAME_DUE, VOCATIVE, Rafiq, prompt
from app.rafiq.name import named_last_time, without_name
from app.rafiq.schemas import Classification, Draft, TextBlock, Turn
from app.rafiq.warmth import screened
from app.retrieval import retriever as retriever_module
from app.retrieval.retriever import Retriever

from .fakes import WUDU, DownMcp, FakeChat, FakeEmbedder, index


@pytest.fixture(autouse=True)
def low_threshold(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(retriever_module, "WEAK_COSINE", 0.2)


def rafiq(chat: FakeChat) -> Rafiq:
    return Rafiq(chat, Retriever(index(WUDU), FakeEmbedder(), DownMcp()))


def classified(language: str = "en", **fields: object) -> Classification:
    return Classification.model_validate(
        {"language": language, "level": "A", "intent": "religious", **fields}
    )


NAMED = Draft(
    opening="Let us look at it together, {{name}}.",
    answer="{{name}}, you wash your face, your arms and your feet [1].",
    followUp="Shall we look at ghusl next?",
    adequate=True,
)


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("That is a good thing to ask, {{name}}.", "That is a good thing to ask."),
        ("{{name}}, that is a good thing to ask.", "That is a good thing to ask."),
        ("Thank you. {{ Name }}, shall we go on?", "Thank you. Shall we go on?"),
        ("Thank you, {{name}}, for asking.", "Thank you for asking."),
        ("سؤال جميل يا {{name}}.", "سؤال جميل."),
        ("يا {{name}}، هذا سؤال جميل.", "هذا سؤال جميل."),
        ("أهلًا بك، يا {{name}}، في رحلتك.", "أهلًا بك في رحلتك."),
        ("No name here.", "No name here."),
    ],
)
def test_the_placeholder_leaves_cleanly_with_its_vocative_and_comma(
    text: str, expected: str
) -> None:
    assert without_name(text) == expected


def test_a_reply_that_used_the_name_is_noticed_in_the_history() -> None:
    assert named_last_time(
        [Turn(role="user", text="Hi"), Turn(role="assistant", text="Hello, {{name}}.")]
    )
    assert not named_last_time(
        [Turn(role="assistant", text="Hello, {{name}}."), Turn(role="assistant", text="Hi.")]
    )
    assert not named_last_time(None)


def test_the_prompts_teach_the_placeholder_and_keep_it_out_of_the_answer() -> None:
    due = NAME_DUE.format(field="encouragement", vocative=VOCATIVE["ar"])
    generate = prompt("generate", language_name="English", mode_rules="", name_rule=due)
    assert "«يا {{name}}»" in generate
    assert 'Never write {{name}} in "answer"' in generate
    assert "{{name}}" in prompt("talk", language_name="English", name_rule=due, road="")


async def test_the_name_stays_in_the_opening_and_never_in_the_cited_answer() -> None:
    # An opening is written only when the learner said something personal.
    answer = await rafiq(FakeChat(classified(talk=True), [NAMED])).run(
        "I'm nervous. How do I perform wudu?", "en"
    )

    assert answer.opening == "Let us look at it together, {{name}}."
    texts = [block.text for block in answer.blocks if isinstance(block, TextBlock)]
    assert texts
    assert all("{{" not in text for text in texts)
    assert texts[0].startswith("You wash your face")


async def test_the_name_is_not_used_in_two_replies_in_a_row() -> None:
    history = [
        Turn(role="user", text="What is wudu?"),
        Turn(role="assistant", text="Good question, {{name}}.\nWudu is washing."),
    ]
    answer = await rafiq(FakeChat(classified(talk=True), [NAMED])).run(
        "I'm nervous. How do I perform wudu?", "en", history=history
    )

    assert answer.opening == "Let us look at it together."


def test_an_arabic_opening_with_the_vocative_passes_the_language_check() -> None:
    assert screened({"opening": "سؤال جميل يا {{name}}."}, [], "ar") == {
        "opening": "سؤال جميل يا {{name}}."
    }
