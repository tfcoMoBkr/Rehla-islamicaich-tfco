"""Lens as a conversation about the photo: each turn routed by code, the decision table applied to
every turn, the photo sent only when a turn needs it, and suggestions that are questions only.
Fake models only."""

import base64
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient
from pydantic import BaseModel

from app.api import RateLimiter, Services
from app.config import get_settings
from app.lens.conversation import fit_suggestions, photo_context
from app.lens.lens import Lens
from app.lens.schemas import Look, Seen, Suggestions, TurnRequest, TurnResponse, TurnRoute
from app.main import app
from app.rafiq.schemas import RafiqAnswer, Turn

IMAGE = "data:image/jpeg;base64,AAAA"


class FakeChat:
    def __init__(self, route: TurnRoute, suggestions: list[str] | None = None) -> None:
        self.route, self.suggestions = route, suggestions or []
        self.systems: list[str] = []

    async def json[T: BaseModel](self, system: str, user: str, schema: type[T]) -> T:
        self.systems.append(system)
        if schema is TurnRoute:
            return self.route  # type: ignore[return-value]
        if schema is Suggestions:
            return Suggestions(questions=self.suggestions)  # type: ignore[return-value]
        raise AssertionError(schema)


class FakeVision:
    def __init__(self, look: Look) -> None:
        self.look = look
        self.images: list[str | None] = []
        self.questions: list[str] = []

    async def json[T: BaseModel](
        self, system: str, user: str, schema: type[T], *, image: str | None = None
    ) -> T:
        assert schema is Look
        self.images.append(image)
        self.questions.append(user)
        return self.look  # type: ignore[return-value]


class FakeRafiq:
    """Records each question and its context; drops every everyday line named in `religious`."""

    def __init__(self, chat: FakeChat, religious: set[str] | None = None) -> None:
        self.chat = chat
        self.religious = religious or set()
        self.asked: list[tuple[str, list[Turn]]] = []

    async def run(
        self, question: str, locale: str, *, history: list[Turn], **_: object
    ) -> RafiqAnswer:
        self.asked.append((question, history))
        return RafiqAnswer(language=locale, level="A", referred=False, blocks=[], sources=[])

    async def everyday(self, lines: dict[str, str], locale: str) -> dict[str, str]:
        return {k: v for k, v in lines.items() if k not in self.religious}


class NoLookup:
    async def find_quoted(
        self, quote: str, language: str, sources: tuple[str, ...] = ()
    ) -> tuple[Any, Any]:
        return None, None


def seen(**fields: object) -> Seen:
    base: dict[str, Any] = {
        "kind": "object",
        "subject": "prayer mat",
        "confidence": 0.9,
        "category": "worship",
    }
    return Seen.model_validate({**base, **fields})


def request(question: str, **fields: object) -> TurnRequest:
    base: dict[str, Any] = {"locale": "en", "seen": seen(), "question": question}
    return TurnRequest.model_validate({**base, **fields})


async def turn(
    route: TurnRoute,
    *,
    look: Look | None = None,
    image: str | None = None,
    religious: set[str] | None = None,
    suggestions: list[str] | None = None,
    **fields: object,
) -> tuple[TurnResponse, FakeRafiq, FakeVision]:
    chat = FakeChat(route, suggestions)
    rafiq = FakeRafiq(chat, religious)
    vision = FakeVision(look or Look(answer="It is green with a pattern of arches."))
    lens = Lens(vision, rafiq, NoLookup())  # type: ignore[arg-type]
    response = await lens.turn(
        request(str(fields.pop("question", "What colour is it?")), **fields), image
    )
    return response, rafiq, vision


async def test_a_visual_question_asks_for_the_photo_then_the_vision_model_answers_it() -> None:
    route = TurnRoute(visual=True, visualQuestion="What colour is the mat?")
    first, rafiq, vision = await turn(route)
    assert first.status == "needsImage"
    assert vision.images == []

    second, rafiq, vision = await turn(route, image=IMAGE)
    assert second.status == "answered"
    assert second.visual == "It is green with a pattern of arches."
    assert vision.images == [IMAGE]
    assert vision.questions == ["What colour is the mat?"]
    assert rafiq.asked == []


async def test_a_question_about_meaning_goes_to_rafiq_about_the_thing_itself() -> None:
    route = TurnRoute(meaning=True, meaningQuestion="What is a prayer mat used for?")
    response, rafiq, vision = await turn(route, question="Why do people use it?")
    assert response.status == "answered"
    assert vision.images == []
    question, history = rafiq.asked[0]
    assert question == "What is a prayer mat used for?"
    assert history[0].text == "(We are looking at a photo of: prayer mat.)"


async def test_ordinary_talk_about_the_photo_goes_to_rafiq_as_talk() -> None:
    response, rafiq, vision = await turn(TurnRoute(talk=True), question="Thanks, it is a nice one.")
    assert rafiq.asked[0][0] == "Thanks, it is a nice one."
    assert response.visual is None
    assert vision.images == []


async def test_a_turn_that_combines_both_shows_one_reply_with_both_parts() -> None:
    route = TurnRoute(
        visual=True,
        meaning=True,
        visualQuestion="What is drawn on it?",
        meaningQuestion="What is it for?",
    )
    response, rafiq, _ = await turn(route, image=IMAGE)
    assert response.visual
    assert response.answer is not None
    assert rafiq.asked[0][0] == "What is it for?"


async def test_the_vision_model_never_describes_people_or_reads_a_document() -> None:
    people, _, _ = await turn(TurnRoute(visual=True), look=Look(aboutPeople=True), image=IMAGE)
    assert (people.visual, people.card) == (None, "person")
    document, _, _ = await turn(TurnRoute(visual=True), look=Look(readsDocument=True), image=IMAGE)
    assert (document.visual, document.card) == (None, "privacy")


async def test_a_religious_claim_in_the_visual_answer_is_dropped() -> None:
    response, _, _ = await turn(TurnRoute(visual=True), image=IMAGE, religious={"visual"})
    assert response.visual is None


@pytest.mark.parametrize(
    ("fields", "card"),
    [
        ({"kind": "person", "subject": ""}, "person"),
        ({"category": "personalDocument"}, "privacy"),
        ({"kind": "unsafe"}, "unsafe"),
        ({"quality": "blurry", "confidence": 0.5}, "unclear"),
    ],
)
async def test_the_decision_table_applies_to_every_follow_up(
    fields: dict[str, object], card: str
) -> None:
    response, rafiq, vision = await turn(
        TurnRoute(visual=True, meaning=True), image=IMAGE, seen=seen(**fields)
    )
    assert (response.status, response.card) == ("declined", card)
    assert rafiq.asked == []
    assert vision.images == []


async def test_a_ruling_request_keeps_going_to_rafiq_for_the_specialist_card() -> None:
    paper = seen(kind="document", category="rulingRequest", subject="contract")
    _, rafiq, vision = await turn(
        TurnRoute(visual=True), image=IMAGE, seen=paper, question="Can I sign it?"
    )
    assert rafiq.asked[0][0] == "Can I sign it?"
    assert vision.images == []


async def test_scripture_text_is_never_handed_to_rafiq_as_context() -> None:
    sign = seen(kind="text", visibleText={"text": "قاعة الصلاة", "language": "ar"}, category="sign")
    assert "قاعة الصلاة" in photo_context(sign)
    verse = sign.model_copy(update={"looks_like_scripture": True})
    assert "قاعة الصلاة" not in photo_context(verse)


def test_suggestions_are_short_questions_only_and_never_repeat_what_was_asked() -> None:
    kept = fit_suggestions(
        [
            "What is the pattern on it?",
            "It is used for prayer.",
            "Great question?",
            "What colour is it?",
            "How is it folded? And where is it kept?",
            "Is there anything written on it, in very small letters near the edge of the mat?",
            "Where is it usually kept?",
            "ما الذي رُسم عليه؟",
        ],
        "en",
        asked=["What colour is it?"],
    )
    assert kept == ["What is the pattern on it?", "Where is it usually kept?"]


async def test_each_reply_comes_with_suggested_questions() -> None:
    response, _, _ = await turn(
        TurnRoute(talk=True), suggestions=["What is it made of?", "It helps you pray."]
    )
    assert response.suggestions == ["What is it made of?"]


@pytest.fixture
def client() -> Iterator[tuple[TestClient, list[str | None]]]:
    get_settings.cache_clear()
    images: list[str | None] = []

    class Stub:
        async def turn(self, request: TurnRequest, image: str | None) -> TurnResponse:
            images.append(image)
            return TurnResponse(status="needsImage" if image is None else "answered")

    with TestClient(app) as test_client:
        app.state.services = Services(
            limiter=RateLimiter(10),
            rafiq=object(),  # type: ignore[arg-type]
            lens=Stub(),  # type: ignore[arg-type]
            lens_limiter=RateLimiter(5),
        )
        yield test_client, images


def test_the_endpoint_takes_the_photo_only_when_sent_and_stores_nothing(
    client: tuple[TestClient, list[str | None]],
) -> None:
    test_client, images = client
    body = {
        "locale": "en",
        "seen": seen().model_dump(by_alias=True),
        "question": "What colour is it?",
    }
    assert test_client.post("/lens/turn", json=body).json()["status"] == "needsImage"
    jpeg = base64.b64encode(b"\xff\xd8\xff" + b"\0" * 32).decode()
    assert (
        test_client.post("/lens/turn", json={**body, "image": jpeg}).json()["status"] == "answered"
    )
    assert images == [None, f"data:image/jpeg;base64,{jpeg}"]
