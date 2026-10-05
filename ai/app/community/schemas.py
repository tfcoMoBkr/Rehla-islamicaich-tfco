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


class CheckResponse(Camel):
    # False when the model could not be asked in time: the post goes through.
    checked: bool
    danger: bool = False
    distress: bool = False
    personal_ruling: bool = False
