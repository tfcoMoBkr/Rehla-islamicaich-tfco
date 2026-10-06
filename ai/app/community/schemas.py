"""Shapes at the boundary of POST /community/check."""

from typing import Annotated

from pydantic import Field

from app.rafiq.schemas import Camel, PageLocale


class CheckRequest(Camel):
    # A post's title and body together, or a reply.
    text: Annotated[str, Field(min_length=1, max_length=3200)]
    locale: PageLocale


class ModelCheck(Camel):
    distress: bool = False
    personal_ruling: bool = False
    religious_claim: bool = False


class CheckResponse(Camel):
    # False when the model could not be asked in time: the post is held, not published.
    checked: bool
    danger: bool = False
    distress: bool = False
    personal_ruling: bool = False
    # The text rules on something, says what Islam teaches, or quotes a verse or hadith: not
    # published; the writer is pointed to Rafiq or a specialist.
    religious_claim: bool = False
