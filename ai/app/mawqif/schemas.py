"""Shapes at the boundary of POST /mawqif/evaluate."""

from typing import Annotated, Literal

from pydantic import Field

from app.rafiq.schemas import Camel, PageLocale

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
