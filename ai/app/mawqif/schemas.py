"""Shapes at the boundary of POST /mawqif/evaluate."""

from typing import Annotated, Literal

from pydantic import Field

from app.rafiq.schemas import Camel, PageLocale, Turn

Status = Literal["evaluated", "question", "distress", "danger", "unavailable", "unknownTurn"]


class EvaluateRequest(Camel):
    situation_id: Annotated[str, Field(min_length=1, max_length=40)]
    turn_id: Annotated[str, Field(min_length=1, max_length=20)]
    reply: Annotated[str, Field(min_length=1, max_length=500)]
    locale: PageLocale


class ModelEvaluation(Camel):
    """What the model returns. Code decides what of it is shown."""

    met: list[str] = Field(default_factory=list)
    tone: Literal["fine", "gentler"] = "fine"
    asks_question: bool = False
    distress: bool = False
    encouragement: Annotated[str, Field(max_length=400)] = ""


class EvaluateResponse(Camel):
    status: Status
    # Key point ids, in the turn's order; the page shows their quoted sources.
    met: list[str] = Field(default_factory=list)
    missing: list[str] = Field(default_factory=list)
    tone: Literal["fine", "gentler"] | None = None
    # One warm sentence that passed the warm-line checks, or None (the page shows a fixed line).
    encouragement: str | None = None


# Practice as a conversation (app/mawqif/practice.py).


class Scene(Camel):
    """A fresh scene inside a situation's theme: who, where, the mood, and their first line."""

    person: Annotated[str, Field(max_length=120)] = ""
    place: Annotated[str, Field(max_length=120)] = ""
    mood: Annotated[str, Field(max_length=80)] = ""
    setting: Annotated[str, Field(max_length=500)] = ""
    line: Annotated[str, Field(max_length=400)] = ""


class StartRequest(Camel):
    situation_id: Annotated[str, Field(min_length=1, max_length=40)]
    locale: PageLocale
    # Scenes already practised, so the next one is different.
    avoid: Annotated[list[Annotated[str, Field(max_length=200)]], Field(max_length=6)] = Field(
        default_factory=list
    )


class StartResponse(Camel):
    status: Literal["ready", "unavailable", "unknownSituation"]
    scene: Scene | None = None


class Line(Camel):
    role: Literal["learner", "character"]
    text: Annotated[str, Field(min_length=1, max_length=500)]


class TurnRequest(Camel):
    situation_id: Annotated[str, Field(min_length=1, max_length=40)]
    locale: PageLocale
    scene: Scene
    history: Annotated[list[Line], Field(max_length=14)] = Field(default_factory=list)
    reply: Annotated[str, Field(min_length=1, max_length=500)]


class ModelTurn(Camel):
    """What the model returns for one turn. Code decides what of it is shown."""

    line: str = ""
    met: list[str] = Field(default_factory=list)
    tone: Literal["fine", "gentler"] = "fine"
    question: bool = False
    ruling: bool = False
    distress: bool = False
    done: bool = False


TurnStatus = Literal[
    "continued",
    "ended",
    "question",
    "ruling",
    "distress",
    "danger",
    "unavailable",
    "unknownSituation",
]


class TurnResponse(Camel):
    status: TurnStatus
    # The other person's next line, checked to carry no religious statement.
    line: str | None = None
    met: list[str] = Field(default_factory=list)
    tone: Literal["fine", "gentler"] | None = None


class ReplyFeedback(Camel):
    n: int
    good: str = ""
    missing: list[str] = Field(default_factory=list)
    # A better reply in ordinary words; its religious words are the situation's own quotes,
    # inserted by code from {{say:ID}} placeholders.
    better: str = ""


class ModelFeedback(Camel):
    replies: list[ReplyFeedback] = Field(default_factory=list)


class FeedbackRequest(Camel):
    situation_id: Annotated[str, Field(min_length=1, max_length=40)]
    locale: PageLocale
    scene: Scene
    history: Annotated[list[Line], Field(min_length=1, max_length=14)]
    # Key point ids the turns found met; feedback never calls them missing.
    met: Annotated[list[Annotated[str, Field(max_length=20)]], Field(max_length=20)] = Field(
        default_factory=list
    )


class ExplainRequest(Camel):
    """A quote of a situation the learner does not understand: Rafiq explains it in place, then
    answers their questions about it."""

    situation_id: Annotated[str, Field(min_length=1, max_length=40)]
    quote_ref: Annotated[str, Field(min_length=1, max_length=40)]
    mode: Literal["explain", "simpler", "question"] = "explain"
    question: Annotated[str, Field(max_length=500)] | None = None
    locale: PageLocale
    history: Annotated[list[Turn], Field(max_length=8)] = Field(default_factory=list)


class FeedbackResponse(Camel):
    status: Literal["ready", "unavailable", "unknownSituation"]
    replies: list[ReplyFeedback] = Field(default_factory=list)
