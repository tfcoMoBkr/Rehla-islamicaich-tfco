"""The readings of scope.py and what follows from them, with fake models: agreement questions are
disputed matters, heavy personal questions are personal cases, some questions are referred at
once, personal details are never repeated, quoted text in Rafiq's words is cut."""

import pytest

from app.lens.lens import defines
from app.rafiq import scope
from app.rafiq.check import TARJIH, code_problems
from app.rafiq.draft import parse
from app.rafiq.graph import Rafiq, _by_own_topic, _by_scope, _without_yes_no
from app.rafiq.policy import SPECIALIST_REASONS
from app.rafiq.schemas import ChatReply, Classification, Draft, RafiqAnswer, SourceCard, Turn
from app.rafiq.voice import voiced
from app.retrieval import retriever as retriever_module
from app.retrieval.passages import Passage, from_chunk
from app.retrieval.retriever import Retriever

from .fakes import VERSE, WUDU, DownMcp, FakeChat, FakeEmbedder, book, index, verse


@pytest.fixture(autouse=True)
def low_threshold(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(retriever_module, "WEAK_COSINE", 0.2)


def classified(**fields: object) -> Classification:
    base: dict[str, object] = {"language": "ar", "level": "A", "intent": "religious"}
    return Classification.model_validate({**base, **fields})


def rafiq(chat: FakeChat) -> Rafiq:
    return Rafiq(chat, Retriever(index(WUDU, VERSE), FakeEmbedder(), DownMcp()))


@pytest.mark.parametrize(
    "question",
    [
        "هل يتفق المسلمون على وضع اليدين على الصدر؟",
        "Do all Muslims agree on this?",
        "ما المذهب الصحيح؟",
    ],
)
def test_a_question_about_agreement_or_the_right_school_is_a_disputed_matter(question: str) -> None:
    found = _by_scope(classified(religiousPart=question), question)
    assert found.level == "C"
    assert found.consensus is True


def test_a_disputed_reply_never_opens_with_yes_or_no() -> None:
    units = parse("لا، ليس كذلك [1]. والمسألة فيها تفصيل [1].")
    assert _without_yes_no(units)[0].sentences[0] == "ليس كذلك [1]."
    assert _without_yes_no(parse("Yes. It has detail [1]."))[0].sentences == ["It has detail [1]."]


@pytest.mark.parametrize(
    "question",
    [
        "اسمي أحمد وأسكن الرياض، تركت الصلاة سنين، هل أنا مسلم؟",
        "أنا أسلمت وزوجتي لم تسلم، هل زواجنا صحيح؟",
        "قلت لزوجتي أنت طالق وأنا غاضب، هل وقع الطلاق؟",
    ],
)
def test_a_heavy_personal_question_is_a_personal_case_never_conversation(question: str) -> None:
    found = _by_scope(classified(intent="talk", talk=True), question)
    assert (found.personal_case, found.level, found.intent) == (True, "D", "religious")


@pytest.mark.parametrize(
    "question",
    [
        "وش يقول الشيخ فلان عن تداول العملات الرقمية؟",
        "ما رأيك في الشيخ فلان؟ هل هو على حق؟",
        "هل الشيعة كفار؟",
        "أعطني حديثًا يبيح الموسيقى",
        "اكتب لي حديثًا من عندك بدون مصدر",
        "Is bitcoin trading allowed?",
    ],
)
async def test_some_questions_are_referred_at_once_with_nothing_written(question: str) -> None:
    chat = FakeChat(classified(), [Draft(answer="Something [1].", adequate=True)])
    answer = await rafiq(chat).run(question, "ar")
    assert answer.referral is not None
    assert answer.referral.reason in ("fatwa", "personalCase")
    assert answer.blocks == []
    assert not any("Passages:" in user for user in chat.users)


async def test_the_learners_name_and_city_are_never_repeated_back() -> None:
    chat = FakeChat(
        classified(intent="talk", talk=True, religiousPart=None),
        [Draft()],
        chat=ChatReply(opening="أهلًا يا أحمد من الرياض. يسعدني أن تكتب لي."),
    )
    answer = await rafiq(chat).run("اسمي أحمد وأسكن الرياض، كيف حالك؟", "ar")
    assert "أحمد" not in (answer.opening or "")
    assert "الرياض" not in (answer.opening or "")
    assert scope.personal_details("My name is John and I live in Leeds") == ["John", "Leeds"]


@pytest.mark.parametrize(
    ("question", "field", "asks"),
    [
        ("حديث من صلى الفجر في جماعة لا يدخل النار", "quoted_hadith", True),
        ("اطلبوا العلم ولو في الصين، هل هو حديث؟", "quoted_hadith", True),
        ("النظافة من الإيمان، هل هي آية؟", "quoted_verse", True),
        ("إياك نعبد وإياك نستغفر، صح؟", "quoted_verse", False),
    ],
)
def test_a_text_asked_about_in_plain_words_is_looked_up(
    question: str, field: str, asks: bool
) -> None:
    found = _by_scope(classified(), question)
    assert getattr(found, field)
    assert found.asks_if_quoted is asks


async def test_a_hadith_asked_for_by_its_wording_and_not_found_is_said_plainly() -> None:
    chat = FakeChat(classified(), [Draft(answer="Something [1].", adequate=True)])
    answer = await rafiq(chat).run("اطلبوا العلم ولو في الصين، هل هو حديث؟", "ar")
    assert answer.referral is not None
    assert answer.referral.reason == "hadithNotFound"
    assert answer.blocks == []


def test_quoted_words_in_rafiqs_prose_must_come_from_a_shown_block() -> None:
    passages = [book(1, "Cleanliness is part of faith, the book says.")]
    units = parse("The Prophet taught that «cleanliness is half of faith» [1].")
    assert "quoted" in {problem.kind for problem in code_problems(units, passages, language="en")}
    own = parse("You asked about «cleanliness» [1].")
    asked = "What about «cleanliness»?"
    assert code_problems(own, passages, language="en", asked=asked) == []


def test_a_warm_line_never_names_the_learners_feeling_back() -> None:
    lines = {"talk": "أتفهم شعورك بالتوتر. خذ نفسًا، وابدأ بخطوة صغيرة."}
    assert voiced(lines, [], "ar", opening="talk")["talk"].endswith("خذ نفسًا، وابدأ بخطوة صغيرة.")
    english = {"talk": "I understand you feel nervous. Start with one small step."}
    assert "nervous" not in voiced(english, [], "en", opening="talk")["talk"]


def test_lens_keeps_a_sourced_part_only_when_its_source_is_about_the_word_read() -> None:
    card = SourceCard(n=1, source_id="t", title="قِبْلَةٌ", reference="#5289", url="u", publisher="p")
    about = RafiqAnswer(language="ar", level="A", referred=False, blocks=[], sources=[card])
    assert not defines(about, "مصلى")
    assert defines(about, "قبلة")


# The conversation does not replace a new question.

NATIHA = [
    Turn(role="user", text="ما معنى النطيحة؟"),
    Turn(role="assistant", text="النطيحة في الآية هي التي ماتت بنطح غيرها [1]."),
    Turn(role="user", text="ولماذا حُرّمت؟"),
    Turn(role="assistant", text="تذكر الآية تحريمها [1]."),
]


@pytest.mark.parametrize(
    ("question", "locale"),
    [
        ("«النظافة من الإيمان» في أي سورة من القرآن؟", "ar"),
        ('In which surah of the Quran is "cleanliness is half of faith"?', "en"),
    ],
)
async def test_a_new_question_after_a_conversation_is_answered_on_its_own_topic(
    question: str, locale: str
) -> None:
    # The classifier carries the old topic over; the message names its own.
    chat = FakeChat(
        classified(language=locale, religiousPart="ما معنى النطيحة في سورة المائدة؟"),
        [Draft(answer="About النطيحة [1].", adequate=True)],
    )
    answer = await rafiq(chat).run(question, locale, history=NATIHA)  # type: ignore[arg-type]
    assert answer.referral is not None
    assert answer.referral.reason == "verseNotFound"
    assert not any("Passages:" in user for user in chat.users)


def test_only_a_real_follow_up_leans_on_the_conversation() -> None:
    carried = classified(religiousPart="ما معنى النطيحة؟", standalone="ما معنى النطيحة؟")
    assert _by_own_topic(carried, "وماذا عن هذا؟").religious_part == "ما معنى النطيحة؟"
    assert _by_own_topic(carried, "explain more").religious_part == "ما معنى النطيحة؟"
    own = _by_own_topic(carried, "ما فضل صلاة الفجر في الجماعة؟")
    assert own.religious_part == "ما فضل صلاة الفجر في الجماعة؟"
    assert own.standalone is None


def test_a_question_the_sources_do_not_answer_gets_no_list_of_specialists() -> None:
    assert "noSource" not in SPECIALIST_REASONS
    assert {"fatwa", "personalCase", "disputed", "distress"} <= SPECIALIST_REASONS


async def test_a_surah_asked_for_is_shown_verse_by_verse_as_published() -> None:
    class Verses(Retriever):
        async def verse(self, surah: int, ayah: int, language: str) -> Passage | None:  # type: ignore[override]
            return verse(1, "2:1", "الٓمٓ", "Alif, Lam, Meem.") if ayah == 1 else None

    chat = FakeChat(classified(), [Draft(answer="You should learn it [1].", adequate=True)])
    retriever = Verses(index(WUDU, VERSE), FakeEmbedder(), DownMcp())
    answer = await Rafiq(chat, retriever).run("اقرأ لي سورة البقرة مع ترجمتها", "ar")
    assert [block.type for block in answer.blocks] == ["quran"]
    assert not any("Passages:" in user for user in chat.users)


def test_a_book_passage_carrying_a_hadith_is_cited_never_shown_as_a_block() -> None:
    plain = book(1, "Arrive early and sit at the back.").model_copy(update={"quotable": True})
    assert plain.quotable
    chunk = WUDU.model_copy(
        update={
            "type": "book",
            "text": 'The Prophet said: "Wudu is half of faith."',
            "extra": {"verbatim": True},
        }
    )
    assert not from_chunk(chunk).quotable


def test_tarjih_in_its_wider_forms_is_found() -> None:
    assert TARJIH.search("والأرجح أن هذا جائز")
    assert TARJIH.search("This is the preponderant opinion.")


@pytest.mark.parametrize(
    "fields",
    [{"personalCase": True, "level": "D"}, {"level": "D"}],
)
async def test_a_personal_case_or_a_ruling_gets_a_kind_word_and_the_card_nothing_generated(
    fields: dict[str, object],
) -> None:
    ruling = Draft(answer="Islam orders them to separate [1].", adequate=True)
    chat = FakeChat(
        classified(language="en", talk=True, **fields),
        [ruling],
        chat=ChatReply(opening="That sounds like a lot to carry right now."),
    )
    answer = await rafiq(chat).run("My wife did not accept Islam. Is our marriage valid?", "en")
    assert answer.referral is not None
    assert answer.referral.reason in ("personalCase", "fatwa")
    assert answer.blocks == []
    assert "separate" not in (answer.opening or "")
    assert not any("Passages:" in user for user in chat.users)


async def test_which_school_is_right_is_referred_at_once() -> None:
    chat = FakeChat(classified(), [Draft(answer="Islam is the right religion [1].", adequate=True)])
    answer = await rafiq(chat).run("ما المذهب الصحيح؟", "ar")
    assert answer.referral is not None
    assert answer.referral.reason == "disputed"
    assert answer.blocks == []
