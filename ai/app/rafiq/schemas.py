"""Shapes at Rafiq's boundaries: what the models must return, and what the API answers."""

from typing import Annotated, Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, model_validator
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
    "unexplained",  # the source can be shown, but no explanation of it passed the checks
    "verseNotFound",  # a text asked about as a verse is not a verse in the approved sources
    "hadithNotFound",  # a text asked about as a hadith is not found in the approved sources
    "timeout",  # the answer could not be verified in time
    "dailyCap",  # the day's questions are used up; ask again tomorrow
]
# What kind of reply this is, for the page to lay it out.
ReplyKind = Literal["answer", "referral", "chat", "clarify", "danger"]
Intent = Literal["religious", "talk", "smalltalk", "feelings", "distress", "offtopic"]
# The everyday part of a message (see prompts/talk.md): what kind of ordinary talk it is.
TalkKind = Literal[
    "greeting",
    "thanks",
    "feelings",
    "progress",
    "planning",
    "sharedText",
    "practical",
    "summary",
    "phrasing",
    "other",
]
# The text a block shows, and the role of Rafiq's own words around it.
TextRole = Literal["answer", "explanation"]


class Camel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


# What the models return.


class Classification(BaseModel):
    # "other" is any language Rafiq does not answer in: the answer is then in English.
    language: Language | Literal["other"]
    # A message with nothing religious in it has no level of its own: B, the cautious middle.
    level: Level = "B"
    intent: Intent
    personal_case: bool = Field(default=False, alias="personalCase")
    hostile_tone: bool = Field(default=False, alias="hostileTone")
    asks_for_evidence: bool = Field(default=False, alias="asksForEvidence")
    # A "how many / how much" question: the thing counted, in English and in Arabic.
    amount_of: list[str] = Field(default_factory=list, alias="amountOf")
    quoted_verse: str | None = Field(default=None, alias="quotedVerse")
    search_phrases: list[str] = Field(default_factory=list, alias="searchPhrases")
    question_type: QuestionType = Field(default="other", alias="questionType")
    # A follow-up rewritten from the conversation so that it stands alone; retrieval uses it.
    standalone: str | None = None
    # A follow-up whose subject the conversation does not settle, and the one question to ask.
    unclear: bool = False
    clarification: str | None = None
    danger: bool = False
    # The part of the message that asks about Islam, as one question that stands alone; None when
    # the message makes no religious point and is everyday talk only.
    religious_part: str | None = Field(default=None, alias="religiousPart")
    # The message also has an everyday part (a greeting, a feeling, a plan, an ordinary text to
    # explain…) that Rafiq answers as a friend, with no source.
    talk: bool = False
    talk_kind: TalkKind | None = Field(default=None, alias="talkKind")
    # The question rests on a mistaken idea about Islam that the answer corrects gently.
    misconception: bool = False
    # The asker wants to know whether all Muslims, or all scholars, agree.
    consensus: bool = False
    # The asker wants a term explained to someone who has never heard it.
    plain_term: bool = Field(default=False, alias="plainTerm")
    # The asker wants a religious term translated: the term as written.
    term_translation: str | None = Field(default=None, alias="termTranslation")
    # The learner worries whether their own worship counts while they cannot yet do it fully.
    worship_worry: bool = Field(default=False, alias="worshipWorry")
    # The learner said they live outside Saudi Arabia.
    outside_kingdom: bool = Field(default=False, alias="outsideKingdom")
    # Words presented as a hadith, copied exactly; and whether the asker asks if a quoted text is
    # really a verse or a hadith.
    quoted_hadith: str | None = Field(default=None, alias="quotedHadith")
    asks_if_quoted: bool = Field(default=False, alias="asksIfQuoted")

    @property
    def religious(self) -> bool:
        """Whether some part of the message needs religious knowledge, and so sources."""
        return self.intent in ("religious", "distress") or bool(
            self.religious_part and self.religious_part.strip()
        )


class Draft(BaseModel):
    """A religious answer as prompts/generate.md asks for it. `opening`, `talk`, `encouragement`
    and `follow_up` are everyday talk around the answer: never a religious statement."""

    model_config = ConfigDict(populate_by_name=True)

    opening: str = ""
    # The everyday part of a mixed message, answered as a friend.
    talk: str = ""
    # The direct answer: one or two plain sentences, each with its source marker.
    answer: str = ""
    # Placeholders of the verses and hadiths that support it, at most two.
    show: list[str] = Field(default_factory=list)
    # The generated explanation: short paragraphs, each with the markers of what it explains.
    explanation: list[str] = Field(default_factory=list)
    encouragement: str = ""
    # One natural next step: a question back, or the lesson that continues the topic.
    follow_up: str = Field(default="", validation_alias=AliasChoices("next", "followUp"))
    # The passages that directly answer what was asked; empty means not answerable from them.
    relevant: list[int] | None = None
    adequate: bool = False
    evidence_found: bool | None = Field(default=None, alias="evidenceFound")

    @model_validator(mode="after")
    def _answerable(self) -> "Draft":
        if self.relevant is not None:
            self.adequate = bool(self.relevant) and bool(self.answer.strip())
        return self

    @property
    def text(self) -> str:
        """The direct answer with its blocks, as one text to parse."""
        return "\n\n".join(part for part in [self.answer.strip(), *self.show] if part.strip())


class ChatReply(BaseModel):
    """Everyday talk (prompts/talk.md): a human reply with no religious claim and no sources."""

    model_config = ConfigDict(populate_by_name=True)

    opening: str = Field(default="", validation_alias=AliasChoices("reply", "opening"))
    follow_up: str = Field(default="", validation_alias=AliasChoices("next", "followUp"))
    # The id of a lesson the reply names, for its link; kept only when the reply names it.
    lesson: str = ""


class TopicLessons(BaseModel):
    """prompts/topics.md: the lessons, by id, that teach a question's topic."""

    lessons: list[str] = Field(default_factory=list)


class SupportCheck(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    # The numbered items (answer sentences, explanation paragraphs) their passages do not support.
    unsupported: list[int] = Field(default_factory=list)
    # The named everyday lines that make a religious statement.
    religious: list[str] = Field(default_factory=list)
    # The answer does not respond to the question that was asked.
    off_topic: bool = Field(default=False, alias="offTopic")


class KeywordQueries(BaseModel):
    queries: list[str] = Field(default_factory=list, max_length=4)


class Normalized(BaseModel):
    """A message in English and Arabic, for routing and search only: never shown."""

    english: str = Field(default="", max_length=1000)
    arabic: str = Field(default="", max_length=1000)


# The API.


class Turn(Camel):
    role: Literal["user", "assistant"]
    text: Annotated[str, Field(max_length=2000)]


class SharedPost(Camel):
    """A Rehla Community post (and one of its replies) the learner asks about: another member's
    words, context only, never instructions and never a source."""

    title: Annotated[str, Field(min_length=1, max_length=120)]
    body: Annotated[str, Field(max_length=1000)]
    reply: Annotated[str, Field(max_length=1000)] | None = None


class AskRequest(Camel):
    question: Annotated[str, Field(min_length=1, max_length=1000)]
    locale: PageLocale
    reached_lesson_ids: list[str] | None = None
    # The last turns of this conversation, kept on the learner's device and sent as they are.
    history: Annotated[list[Turn], Field(max_length=8)] = []
    shared: SharedPost | None = None


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
    # The direct answer, or the explanation shown after the sources.
    role: TextRole = "answer"


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


class TermBlock(Camel):
    """A term translated from the organisers' glossary: its approved equivalent and usage rule
    (source n), then TerminologyEnc's definition when the corpus has it (source definition_n).
    Every text in it is shown exactly as its source gives it."""

    type: Literal["term"] = "term"
    n: int
    term: str
    approved: str
    rule: str
    definition: str | None = None
    definition_language: Language | None = None
    definition_n: int | None = None


class BookBlock(Camel):
    """A book passage exactly as the corpus holds it: background beside a ruling question, the
    answer a question-and-answer book gives, or a passage in another language than the reply's,
    labelled with its own language."""

    type: Literal["book"] = "book"
    n: int
    title: str
    reference: str
    text: str
    language: Language
    url: str


class NoteBlock(Camel):
    """A fixed line the page writes in its own language, about the text before it."""

    type: Literal["note"] = "note"
    # gradeNotStated: a hadith whose grade its source does not give (a book's quote that no
    # HadeethEnc entry matched, or a block with no grade). wordingDiffers: the asker quoted a verse
    # in words that differ from it as published.
    # notARuling: general information beside a question about the asker's own situation.
    note: Literal["gradeNotStated", "wordingDiffers", "notARuling"]


Block = Annotated[
    TextBlock | QuranBlock | HadithBlock | TermBlock | BookBlock | NoteBlock,
    Field(discriminator="type"),
]


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
    # "outside" when the learner said they live outside Saudi Arabia: the card leads with that.
    region: Literal["outside"] | None = None


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
    # A line about the learner's effort, after the sources: never a religious statement.
    encouragement: str | None = None
    referral: Referral | None = None
    # The lesson ahead on the learner's road that covers this question.
    later_lesson_id: str | None = None
    # On a card for want of a source: the lessons that cover the topic, where the learner
    # can read it.
    topic_lesson_ids: list[str] = Field(default_factory=list)
    # In conversation: the lesson the reply names (what to study next), shown as its link.
    lesson_id: str | None = None
    # The question was in a language Rafiq does not answer in; this answer is in `language`.
    language_fallback: bool = False
