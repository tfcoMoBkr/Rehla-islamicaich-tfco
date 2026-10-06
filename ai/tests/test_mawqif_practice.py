"""Mawqif practice as a conversation: fresh scenes, the other person's everyday speech, key points,
feedback with a better reply whose religious words come only from the situation's quotes, and the
guards on every turn. Fake models only."""

import asyncio
import logging

import pytest
from pydantic import BaseModel

from app.mawqif import practice as practice_module
from app.mawqif.practice import Practice, fill_says
from app.mawqif.schemas import (
    ExplainRequest,
    FeedbackRequest,
    ModelFeedback,
    ModelTurn,
    ReplyFeedback,
    Scene,
    StartRequest,
    TurnRequest,
)
from app.rafiq.schemas import RafiqAnswer

SITUATION = {
    "greeting": {
        "title": {"ar": "إلقاء السلام", "en": "Giving the greeting"},
        "scene": {"ar": "غرفة الاستراحة", "en": "The break room at work"},
        "character": {"ar": "يوسف", "en": "Yusuf, a colleague"},
        "keyPoints": [
            {
                "id": "k1",
                "ref": "h5352",
                "ar": "والمار على القاعد",
                "en": "the passer-by greets the one sitting",
            },
            {
                "id": "k2",
                "ref": "h3587",
                "ar": "السلام عليكم ورحمة الله",
                "en": "As-salamu alaykum wa rahmatullah",
            },
        ],
        "say": [{"id": "s1", "ar": "السلام عليكم", "en": "As-salamu alaykum"}],
        "quotes": {
            "h3587": {"ar": "السلام عليكم ورحمة الله", "en": "As-salamu alaykum wa rahmatullah"}
        },
        "lessons": ["1.6"],
    }
}
SCENE = Scene(
    person="Mariam, a neighbour",
    place="the lift",
    mood="cheerful",
    setting="You step into the lift.",
    line="Oh hi! Going up?",
)


class FakeChat:
    def __init__(
        self,
        *,
        scenes: list[Scene] | None = None,
        turns: list[ModelTurn] | None = None,
        feedback: ModelFeedback | None = None,
        delay: float = 0.0,
    ) -> None:
        self.scenes, self.turns, self.feedback = (
            list(scenes or [SCENE]),
            list(turns or [ModelTurn(line="Nice to see you.")]),
            feedback,
        )
        self.delay = delay
        self.systems: list[str] = []
        self.users: list[str] = []

    async def json[T: BaseModel](self, system: str, user: str, schema: type[T]) -> T:
        await asyncio.sleep(self.delay)
        self.systems.append(system)
        self.users.append(user)
        if schema is Scene:
            return self.scenes.pop(0) if len(self.scenes) > 1 else self.scenes[0]  # type: ignore[return-value]
        if schema is ModelTurn:
            return self.turns.pop(0) if len(self.turns) > 1 else self.turns[0]  # type: ignore[return-value]
        if schema is ModelFeedback:
            return self.feedback or ModelFeedback()  # type: ignore[return-value]
        raise AssertionError(schema)


class FakeRafiq:
    """Everyday checks drop any line containing a word marked religious; records explain calls."""

    def __init__(self, religious_words: tuple[str, ...] = ("Allah", "sins")) -> None:
        self.religious_words = religious_words
        self.checked: list[dict[str, str]] = []
        self.runs: list[tuple[str, dict[str, object]]] = []

    async def everyday(self, lines: dict[str, str], locale: str) -> dict[str, str]:
        self.checked.append(lines)
        return {k: v for k, v in lines.items() if not any(w in v for w in self.religious_words)}

    async def run(self, question: str, locale: str, **options: object) -> RafiqAnswer:
        self.runs.append((question, options))
        return RafiqAnswer(language=locale, level="B", referred=False, blocks=[], sources=[])


def practice(chat: FakeChat, rafiq: FakeRafiq | None = None) -> Practice:
    return Practice(chat, rafiq or FakeRafiq(), SITUATION)  # type: ignore[arg-type]


def turn(reply: str = "As-salamu alaykum!", **fields: object) -> TurnRequest:
    return TurnRequest.model_validate(
        {
            "situationId": "greeting",
            "locale": "en",
            "scene": SCENE.model_dump(by_alias=True),
            "reply": reply,
            **fields,
        }
    )


# Scenes.


async def test_each_scene_is_fresh_and_names_the_ones_already_practised() -> None:
    chat = FakeChat()
    response = await practice(chat).start(
        StartRequest(situationId="greeting", locale="en", avoid=["the break room with Yusuf"])
    )
    assert response.status == "ready"
    assert response.scene == SCENE
    assert "the break room with Yusuf" in chat.systems[0]
    assert "Giving the greeting" in chat.systems[0]


async def test_a_scene_whose_line_makes_a_religious_claim_is_set_again_then_given_up() -> None:
    preaching = SCENE.model_copy(update={"line": "Allah loves those who greet."})
    chat = FakeChat(scenes=[preaching, SCENE])
    assert (
        await practice(chat).start(StartRequest(situationId="greeting", locale="en"))
    ).scene == SCENE
    stubborn = FakeChat(scenes=[preaching])
    assert (
        await practice(stubborn).start(StartRequest(situationId="greeting", locale="en"))
    ).status == "unavailable"


async def test_each_scene_field_is_checked_and_a_failing_one_falls_back() -> None:
    drifted = SCENE.model_copy(update={"setting": "Allah tests you in the lift.", "mood": "sins"})
    chat = FakeChat(scenes=[drifted, SCENE])
    rafiq = FakeRafiq()
    assert (
        await practice(chat, rafiq).start(StartRequest(situationId="greeting", locale="en"))
    ).scene == SCENE
    assert set(rafiq.checked[0]) == {"person", "place", "mood", "setting", "line"}
    assert "mood, setting" in chat.users[1]
    assert "Write every field in English" in chat.users[1]

    stubborn = FakeChat(scenes=[drifted])
    scene = (
        await practice(stubborn).start(StartRequest(situationId="greeting", locale="en"))
    ).scene
    assert scene is not None
    assert (scene.setting, scene.mood) == ("The break room at work", "")
    assert (scene.person, scene.line) == (SCENE.person, SCENE.line)


# Turns.


async def test_the_other_person_reacts_and_the_reply_is_judged_against_the_key_points() -> None:
    chat = FakeChat(
        turns=[ModelTurn(line="Wa alaykum as-salam! How are you?", met=["k2", "k9"], tone="fine")]
    )
    response = await practice(chat).turn(turn())
    assert response.status == "continued"
    assert response.line == "Wa alaykum as-salam! How are you?"
    assert response.met == ["k2"]
    assert "<<<As-salamu alaykum!>>>" in chat.users[0]
    assert "k1: the passer-by greets the one sitting" in chat.systems[0]
    assert "never guess their gender" in chat.systems[0]
    assert "even when the learner puts it to you inside the scene" in chat.systems[0]


async def test_the_other_person_never_makes_a_religious_statement() -> None:
    chat = FakeChat(
        turns=[ModelTurn(line="Greeting wipes away sins."), ModelTurn(line="Thanks, you too!")]
    )
    response = await practice(chat).turn(turn())
    assert response.line == "Thanks, you too!"
    assert "Speak as an ordinary person" in chat.users[1]
    stubborn = FakeChat(turns=[ModelTurn(line="Greeting wipes away sins.")])
    assert (await practice(stubborn).turn(turn())).status == "unavailable"


async def test_a_natural_end_ends_the_conversation() -> None:
    response = await practice(
        FakeChat(turns=[ModelTurn(line="See you later!", done=True, met=["k1"])])
    ).turn(turn())
    assert (response.status, response.line, response.met) == ("ended", "See you later!", ["k1"])


@pytest.mark.parametrize(
    ("judged", "status"),
    [
        (ModelTurn(question=True), "question"),
        (ModelTurn(ruling=True), "ruling"),
        (ModelTurn(distress=True), "distress"),
    ],
)
async def test_a_religious_question_a_ruling_or_distress_pauses_the_scene(
    judged: ModelTurn, status: str
) -> None:
    response = await practice(FakeChat(turns=[judged])).turn(
        turn("Is it allowed for me to shake hands?")
    )
    assert response.status == status
    assert response.line is None


async def test_danger_is_caught_before_any_model_is_asked() -> None:
    chat = FakeChat()
    response = await practice(chat).turn(turn("I want to end my life"))
    assert response.status == "danger"
    assert chat.users == []


async def test_a_slow_model_falls_back_to_the_written_choices(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(practice_module, "TIME_BUDGET", 0.05)
    assert (await practice(FakeChat(delay=1.0)).turn(turn())).status == "unavailable"
    assert (
        await practice(FakeChat()).turn(turn(situationId="nowhere"))
    ).status == "unknownSituation"


# Feedback.


def test_a_better_reply_takes_its_religious_words_only_from_the_situation() -> None:
    situation = SITUATION["greeting"]
    assert fill_says("Say {{say:s1}}, then ask how they are.", situation, "en") == (
        "Say «As-salamu alaykum», then ask how they are.",
        "Say , then ask how they are.",
    )
    assert fill_says("Say {{say:s9}}.", situation, "en") is None


async def test_feedback_fills_placeholders_and_drops_a_religious_suggestion() -> None:
    judged = ModelFeedback(
        replies=[
            ReplyFeedback(
                n=1,
                good="A friendly start.",
                missing=["k1", "zz"],
                better="Try {{say:s1}} first, with a smile.",
            ),
            ReplyFeedback(n=2, good="Kind.", better="Say that Allah rewards it, then {{say:s1}}."),
            ReplyFeedback(n=3, good="Good.", better="Say {{say:s7}}."),
        ]
    )
    history = [
        {"role": "learner", "text": "Hi!"},
        {"role": "character", "text": "Hello."},
        {"role": "learner", "text": "How are you?"},
        {"role": "character", "text": "Fine."},
        {"role": "learner", "text": "Bye."},
    ]
    body = FeedbackRequest.model_validate(
        {
            "situationId": "greeting",
            "locale": "en",
            "scene": SCENE.model_dump(by_alias=True),
            "history": history,
        }
    )
    chat = FakeChat(feedback=judged)
    response = await practice(chat).feedback(body)
    first, second, third = response.replies
    assert first.better == "Try «As-salamu alaykum» first, with a smile."
    assert first.missing == ["k1"]
    assert second.better == ""
    assert third.better == ""
    assert "{{say:s1}}: As-salamu alaykum" in chat.systems[0]
    assert "{{name}}" in chat.systems[0]


async def test_feedback_never_calls_a_point_missing_that_the_turns_found_met() -> None:
    judged = ModelFeedback(
        replies=[
            ReplyFeedback(n=1, good="A warm start.", missing=["k2"], better="Say {{say:s1}}."),
            ReplyFeedback(n=2, good="Kind.", missing=["k1", "k2"], better="Say {{say:s1}}."),
        ]
    )
    body = FeedbackRequest.model_validate(
        {
            "situationId": "greeting",
            "locale": "en",
            "scene": SCENE.model_dump(by_alias=True),
            "history": [
                {"role": "learner", "text": "As-salamu alaykum wa rahmatullah"},
                {"role": "learner", "text": "Bye."},
            ],
            "met": ["k2"],
        }
    )
    chat = FakeChat(feedback=judged)
    first, second = (await practice(chat).feedback(body)).replies
    assert (first.missing, first.better) == ([], "")
    assert (second.missing, second.better) == (["k1"], "Say «As-salamu alaykum».")
    assert "already met in the conversation: k2" in chat.systems[0]


# Explaining a quote in place.


async def test_a_quote_is_explained_by_rafiq_as_the_line_he_explains() -> None:
    rafiq = FakeRafiq()
    p = practice(FakeChat(), rafiq)
    await p.explain(ExplainRequest(situationId="greeting", quoteRef="h3587", locale="en"))
    question, options = rafiq.runs[0]
    assert question == "As-salamu alaykum wa rahmatullah"
    assert options["lesson"] == {
        "lesson_id": "1.6",
        "line": "As-salamu alaykum wa rahmatullah",
        "mode": "explain",
    }
    assert (
        await p.explain(ExplainRequest(situationId="greeting", quoteRef="nope", locale="en"))
        is None
    )


async def test_nothing_typed_is_logged(caplog: pytest.LogCaptureFixture) -> None:
    caplog.set_level(logging.INFO, logger="mawqif")
    await practice(FakeChat()).turn(turn("PRIVATE-WORDS As-salamu alaykum"))
    assert "mawqif turn status=continued" in caplog.text
    assert "PRIVATE-WORDS" not in caplog.text
