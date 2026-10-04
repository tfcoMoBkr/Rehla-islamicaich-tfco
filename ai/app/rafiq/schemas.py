"""Shapes at Rafiq's boundaries: what the models must return, and what the API answers."""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from app.languages import Language

# The page's own language: interface labels and lessons exist in these two.
PageLocale = Literal["ar", "en"]
QuestionType = Literal["definition", "howTo", "evidence", "list", "comparison", "other"]
Level = Literal["A", "B", "C", "D"]
ReferralReason = Literal[
    "fatwa",  # level D: a ruling is asked for
    "personalCase",  # the asker's own situation
    "disputed",  # level C that the sources do not settle
    "noSource",  # no adequate source was found
    "noEvidence",  # proof was asked for and none matches
    "verification",  # the answer could not be verified against its sources
    "offTopic",
    "smalltalk",
]


class Camel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


# What the models return.


class Classification(BaseModel):
    # "other" is any language Rafiq does not answer in: the answer is then in English.
    language: Language | Literal["other"]
    level: Level
    intent: Literal["religious", "smalltalk", "offtopic"]
    personal_case: bool = Field(default=False, alias="personalCase")
    hostile_tone: bool = Field(default=False, alias="hostileTone")
    asks_for_evidence: bool = Field(default=False, alias="asksForEvidence")
    quoted_verse: str | None = Field(default=None, alias="quotedVerse")
    search_phrases: list[str] = Field(default_factory=list, alias="searchPhrases")
    question_type: QuestionType = Field(default="other", alias="questionType")


class Draft(BaseModel):
    answer: str = ""
    adequate: bool
    evidence_found: bool | None = Field(default=None, alias="evidenceFound")


class SupportCheck(BaseModel):
    unsupported: list[int] = Field(default_factory=list)


class KeywordQueries(BaseModel):
    queries: list[str] = Field(default_factory=list, max_length=4)


# The API.


class Turn(Camel):
    role: Literal["user", "assistant"]
    text: Annotated[str, Field(max_length=2000)]


class AskRequest(Camel):
    question: Annotated[str, Field(min_length=1, max_length=1000)]
    locale: PageLocale
    reached_lesson_ids: list[str] | None = None
    history: Annotated[list[Turn], Field(max_length=4)] = []


class LessonHelpRequest(Camel):
    lesson_id: Annotated[str, Field(min_length=1, max_length=20)]
    card_id: Annotated[str, Field(min_length=1, max_length=40)]
    line_text: Annotated[str, Field(min_length=1, max_length=1000)]
    mode: Literal["simpler", "example", "question"]
    question: Annotated[str, Field(max_length=1000)] | None = None
    locale: PageLocale


class TextBlock(Camel):
    type: Literal["text"] = "text"
    text: str


class QuranBlock(Camel):
    """A verse exactly as QuranEnc publishes it, with the published translation shown beside it."""

    type: Literal["quran"] = "quran"
    n: int
    ref: str
    surah: int
    ayah: int
    surah_name: str | None = None
    arabic: str
    translation: str | None = None
    # The translation's own language; it differs from the answer's when none is published in it.
    translation_language: Language | None = None
    translation_key: str | None = None
    translation_name: str | None = None
    translation_version: str | None = None
    url: str


class HadithBlock(Camel):
    """A hadith exactly as HadeethEnc publishes it: the Arabic, then the published translation."""

    type: Literal["hadith"] = "hadith"
    n: int
    id: int
    title: str
    arabic: str
    text: str | None = None
    text_language: Language | None = None
    grade: str
    attribution: str
    # HadeethEnc's own explanation, shown in extractive answers.
    explanation: str | None = None
    url: str


Block = Annotated[TextBlock | QuranBlock | HadithBlock, Field(discriminator="type")]


class SourceCard(Camel):
    n: int
    # The source's id in content/sources.json, for its entry on the sources page.
    source_id: str
    title: str
    reference: str
    url: str
    publisher: str


class Referral(Camel):
    reason: ReferralReason
    links: list[str] = ["/talk-to-a-human"]


class RafiqAnswer(Camel):
    language: Language
    level: Level | None
    referred: bool
    blocks: list[Block]
    sources: list[SourceCard]
    referral: Referral | None = None
    # The lesson ahead on the learner's road that covers this question.
    later_lesson_id: str | None = None
    # The question was in a language Rafiq does not answer in; this answer is in `language`.
    language_fallback: bool = False
