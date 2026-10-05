"""POST /lesson-help: a conversation about one lesson line, scoped to the lesson first. Fake models
only."""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.api import RateLimiter, Services
from app.languages import Language
from app.main import app
from app.rafiq.graph import Rafiq, prompt
from app.rafiq.schemas import Classification, Draft
from app.retrieval import retriever as retriever_module
from app.retrieval.retriever import Retrieval, Retriever

from .fakes import DownMcp, FakeChat, FakeEmbedder, chunk, index

LINE = "To perform wudu you wash your hands, rinse your mouth and wash your face."
WUDU = chunk(id="book:wudu:1", lessonIds=["2.4"], text=LINE)
DRAFT = Draft(
    opening="Let us look at this line together.",
    answer="You wash your hands and your face [1].",
    adequate=True,
)


class RecordingRetriever(Retriever):
    """Records the scope and focus each retrieval is given."""

    def __init__(self) -> None:
        super().__init__(index(WUDU), FakeEmbedder(), DownMcp())
        self.calls: list[tuple[list[str] | None, str | None]] = []

    async def retrieve(
        self,
        question: str,
        language: Language,
        *,
        scope: list[str] | None = None,
        focus: str | None = None,
        **options: object,
    ) -> Retrieval:
        self.calls.append((scope, focus))
        return await super().retrieve(question, language, scope=scope, focus=focus, **options)  # type: ignore[arg-type]


@pytest.fixture(autouse=True)
def low_threshold(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(retriever_module, "WEAK_COSINE", 0.2)


@pytest.fixture
def chat() -> FakeChat:
    return FakeChat(
        Classification(language="en", level="A", intent="religious", standalone="Why the face?"),
        [DRAFT],
    )


@pytest.fixture
def retriever() -> RecordingRetriever:
    return RecordingRetriever()


@pytest.fixture
def client(chat: FakeChat, retriever: RecordingRetriever) -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        services = Services(rafiq=Rafiq(chat, retriever), limiter=RateLimiter(100))
        test_client.app.state.services = services  # type: ignore[attr-defined]
        yield test_client


def ask(client: TestClient, **fields: object):  # noqa: ANN201 (an httpx response)
    body = {"lessonId": "2.4", "cardId": "c1", "lineText": LINE, "locale": "en", **fields}
    return client.post("/lesson-help", json=body)


def turns(count: int) -> list[dict[str, str]]:
    return [
        {"role": "user" if n % 2 == 0 else "assistant", "text": f"Turn number {n}."}
        for n in range(count)
    ]


def test_the_first_message_explains_the_line(client: TestClient, chat: FakeChat) -> None:
    response = ask(client, mode="explain")

    assert response.status_code == 200
    assert response.json()["kind"] == "answer"
    assert response.json()["opening"] == "Let us look at this line together."
    assert any("explain this line in plain words" in system for system in chat.systems)
    # Explaining a line asks for no ruling: it is not classified.
    assert prompt("classify") not in chat.systems


def test_a_follow_up_is_classified_and_answered_with_the_conversation(
    client: TestClient, chat: FakeChat
) -> None:
    history = [
        {"role": "assistant", "text": "This line lists the first acts of wudu."},
        {"role": "user", "text": "What about the face?"},
    ]
    response = ask(client, mode="question", question="And why?", history=history)

    assert response.status_code == 200
    assert chat.systems[0] == prompt("classify")
    classify, generate = chat.users[0], next(user for user in chat.users if "Passages:" in user)
    assert "This line lists the first acts of wudu." in classify
    assert "Earlier in the conversation:" in generate
    assert "user: What about the face?" in generate
    assert "(It asks: Why the face?)" in generate


def test_the_scope_is_the_lesson_first_then_the_reached_lessons(
    client: TestClient, retriever: RecordingRetriever
) -> None:
    ask(client, mode="simpler", reachedLessonIds=["1.1", "2.4", "2.3"])

    assert retriever.calls == [(["2.4", "1.1", "2.3"], "2.4")]


def test_without_reached_lessons_the_scope_is_the_lesson(
    client: TestClient, retriever: RecordingRetriever
) -> None:
    ask(client, mode="example")

    assert retriever.calls == [(["2.4"], "2.4")]


def test_at_most_eight_turns_of_history_are_accepted(client: TestClient) -> None:
    assert ask(client, mode="explain", history=turns(8)).status_code == 200

    response = ask(client, mode="explain", history=turns(9))

    assert response.status_code == 422
    assert response.json()["error"]["fields"][0]["field"] == "history"


def test_a_question_without_its_words_is_refused(client: TestClient) -> None:
    response = ask(client, mode="question")

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "question_required"
