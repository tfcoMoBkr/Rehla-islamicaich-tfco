"""Shapes at Lens's boundaries: what the vision model must return (SEE), and what /lens answers."""

from typing import Annotated, Literal

from pydantic import Field

from app.rafiq.schemas import Camel, PageLocale, RafiqAnswer

SeenKind = Literal["text", "object", "place", "document", "person", "unsafe", "unclear"]
# What the photo is of, in the terms the decision table needs. Naming it is all the model does.
Category = Literal[
    "worship",  # an object of worship or of a mosque
    "mosque",  # a mosque, a prayer room, a qibla sign
    "sign",  # an ordinary sign, notice, label or door plate
    "food",  # food, drink, a product or an ingredients label
    "personalDocument",  # an ID, passport, bank card, medical paper, private letter or chat
    "rulingRequest",  # a contract or a paper about someone's own situation, asking what is allowed
    "post",  # a screenshot of a post, a fatwa or a claim about Islam
    "otherReligion",  # a symbol or place of another religion
    "ordinary",  # anything else
]
Quality = Literal["good", "blurry", "dark", "cropped"]
Card = Literal["person", "unclear", "privacy", "unsafe", "unmatched", "nothing", "timeout"]


class VisibleText(Camel):
    text: Annotated[str, Field(max_length=2000)]
    language: Annotated[str, Field(max_length=20)]


class Seen(Camel):
    """What the vision model reports. Strict: anything else fails validation and is asked again."""

    kind: SeenKind
    subject: Annotated[str, Field(max_length=60)] = ""
    visible_text: VisibleText | None = None
    plain_translation: Annotated[str, Field(max_length=2000)] | None = None
    looks_like_scripture: bool = False
    people_present: bool = False
    confidence: Annotated[float, Field(ge=0, le=1)]
    category: Category = "ordinary"
    quality: Quality = "good"
    # Religious terms that appear in the text read, as written there (never added by the model).
    religious_terms: Annotated[list[Annotated[str, Field(max_length=60)]], Field(max_length=5)] = (
        Field(default_factory=list)
    )
    # Other things in the photo, for the learner to choose from.
    others: Annotated[list[Annotated[str, Field(max_length=60)]], Field(max_length=4)] = Field(
        default_factory=list
    )


class LensRequest(Camel):
    """A photo (base64, downscaled and stripped of metadata by the browser), or, for an example or a
    chosen subject, a `seen` result to explain without reading any image."""

    image: Annotated[str, Field(max_length=6_000_000)] | None = None
    mime_type: Literal["image/jpeg", "image/png", "image/webp"] = "image/jpeg"
    seen: Seen | None = None
    locale: PageLocale
    reached_lesson_ids: list[str] | None = None


class LensResponse(Camel):
    seen: Seen | None
    # The row of the decision table that applied (docs/RELIABILITY.md); 0 when time ran out.
    row: int
    answer: RafiqAnswer | None = None
    card: Card | None = None
    others: list[str] = Field(default_factory=list)
