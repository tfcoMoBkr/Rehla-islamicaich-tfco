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
    "distress",  # the learner is going through something hard
    "danger",  # a sign of danger to the learner or to others
    "offTopic",
    "smalltalk",
]
# What kind of reply this is, for the page to lay it out.
ReplyKind = Literal["answer", "referral", "chat", "clarify", "danger"]
Intent = Literal["religious", "smalltalk", "feelings", "distress", "offtopic"]


class Camel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


# What the models return.


class Classification(BaseModel):
    # "other" is any language Rafiq does not answer in: the answer is then in English.
    language: Language | Literal["other"]
    level: Level
    intent: Intent
    personal_case: bool = Field(default=False, alias="personalCase")
    hostile_tone: bool = Field(default=False, alias="hostileTone")
    asks_for_evidence: bool = Field(default=False, alias="asksForEvidence")
    quoted_verse: str | None = Field(default=None, alias="quotedVerse")
    search_phrases: list[str] = Field(default_factory=list, alias="searchPhrases")
    question_type: QuestionType = Field(default="other", alias="questionType")
    # A follow-up rewritten from the conversation so that it stands alone; retrieval uses it.
    standalone: str | None = None
    # A follow-up whose subject the conversation does not settle, and the one question to ask.
    unclear: bool = False
    clarification: str | None = None
    danger: bool = False


class Draft(BaseModel):
    # Warmth around the answer: never a religious statement (removed if it is one).
    opening: str = ""
    answer: str = ""
    follow_up: str = Field(default="", alias="followUp")
    adequate: bool = False
    evidence_found: bool | None = Field(default=None, alias="evidenceFound")


class ChatReply(BaseModel):
    """A human reply to small talk or feelings: no religious content, no sources."""

    opening: str = ""
    follow_up: str = Field(default="", alias="followUp")


class SupportCheck(BaseModel):
    unsupported: list[int] = Field(default_factory=list)
    # The warm fields ("opening", "followUp", "clarification") that make a religious statement.
    religious: list[str] = Field(default_factory=list)


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
    # The last turns of this conversation, kept on the learner's device and sent as they are.
    history: Annotated[list[Turn], Field(max_length=8)] = []


# What the learner asks of a lesson line: Rafiq's first explanation of it, a simpler wording, an
# example, or their own question about it.
HelpMode = Literal["explain", "simpler", "example", "question"]


class LessonHelpRequest(Camel):
    lesson_id: Annotated[str, Field(min_length=1, max_length=20)]
    card_id: Annotated[str, Field(min_length=1, max_length=40)]
    line_text: Annotated[str, Field(min_length=1, max_length=1000)]
    mode: HelpMode
    question: Annotated[str, Field(max_length=1000)] | None = None
    locale: PageLocale
    reached_lesson_ids: list[str] | None = None
    # The last turns of this conversation about the line, kept on the learner's device.
    history: Annotated[list[Turn], Field(max_length=8)] = []


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
    links: list[str] = ["/talk-to-a-specialist"]
    # The referral bodies to show, by id in content/referral-centers.json (the web renders them).
    centers: list[str] = Field(default_factory=list)


class RafiqAnswer(Camel):
    language: Language
    level: Level | None
    referred: bool
    kind: ReplyKind = "answer"
    # Warm lines around the cited answer, checked to carry no religious statement.
    opening: str | None = None
    blocks: list[Block]
    sources: list[SourceCard]
    follow_up: str | None = None
    referral: Referral | None = None
    # The lesson ahead on the learner's road that covers this question.
    later_lesson_id: str | None = None
    # The question was in a language Rafiq does not answer in; this answer is in `language`.
    language_fallback: bool = False
