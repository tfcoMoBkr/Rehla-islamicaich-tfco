"""The committee run's fixes: the ruling guard in code, claims of agreement or difference, a
quoted text that is not found, the plain idea first, an altered verse never repeated, a
question-and-answer passage shown, questions in other languages, and the voice. Fake models only;
the texts are placeholders, not religious content."""

import pytest
from pydantic import BaseModel

from app.languages import Language
from app.rafiq.check import code_problems
from app.rafiq.draft import Unit, parse
from app.rafiq.graph import (
    Rafiq,
    _arabic_or_english,
    _by_question_form,
    _checked,
    _passages_text,
    _plain_first,
    _with_book_passage,
    _without_wording,
)
from app.rafiq.guard import NOTE, applies_to_the_asker, guarded, without_rulings
from app.rafiq.schemas import Classification, Draft, Normalized
from app.rafiq.voice import without_formulas
from app.retrieval import retriever as retriever_module
from app.retrieval.passages import Passage
from app.retrieval.retriever import Retriever

from .fakes import VERSE, WUDU, DownMcp, FakeChat, FakeEmbedder, book, hadith, index


@pytest.fixture(autouse=True)
def low_threshold(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(retriever_module, "WEAK_COSINE", 0.2)


def classified(**fields: object) -> Classification:
    base: dict[str, object] = {"language": "en", "level": "B", "intent": "religious"}
    return Classification.model_validate({**base, **fields})


# Priority 1: a ruling in a personal case.


@pytest.mark.parametrize(
    "sentence",
    [
        "Your marriage is not valid without a guardian [1].",
        "This marriage is void [1].",
        "It is forbidden in this case [1].",
        "You must ask your family first [1].",
        "زواجك باطل [1].",
        "لا يجوز ذلك [1].",
        "يجب عليك أن تسأل [1].",
    ],
)
def test_ruling_words_and_speaking_to_the_asker_are_caught(sentence: str) -> None:
    assert applies_to_the_asker(sentence)


def test_a_neutral_sentence_about_the_topic_is_kept() -> None:
    assert not applies_to_the_asker("Marriage in Islam has conditions set out in the sources [1].")
    assert not applies_to_the_asker("هذا السؤال عن شروط النكاح [1].")


def test_a_personal_case_reply_is_one_plain_sentence_one_source_and_the_fixed_line() -> None:
    units = [
        *parse("Marriage has conditions set out in the sources [1]. It is void without one [1]."),
        Unit("block", block=("hadith", "7")),
        *parse("This means your marriage is invalid [1]."),
    ]
    shaped = guarded(units, [hadith(1, 7, "نص", "text")], "en")
    assert [(u.kind, u.sentences, u.block) for u in shaped] == [
        ("paragraph", ["Marriage has conditions set out in the sources [1]."], None),
        ("block", [], ("hadith", "7")),
        ("block", [], NOTE),
    ]
    ruling_first = [*parse("Your marriage is invalid [1]."), *parse("More [1].")]
    shaped = guarded(ruling_first, [book(1, "A passage about marriage.")], "en")
    assert [u.block for u in shaped] == [("book", "1"), NOTE]
    # A passage extracted from a PDF out of order, or in another language, is never quoted.
    scrambled = book(1, "Out of order.").model_copy(update={"quotable": False})
    assert [u.block for u in guarded(ruling_first, [scrambled], "en")] == []
    assert [u.block for u in guarded(ruling_first, [book(1, "نص", lang="ar")], "en")] == []
    assert without_rulings({"opening": "This is hard.", "talk": "It is haram for you."}) == {
        "opening": "This is hard."
    }


async def test_in_the_pipeline_a_personal_case_never_carries_a_ruling() -> None:
    draft = Draft(
        relevant=[1],
        opening="I hear that this weighs on you.",
        answer="Your marriage is invalid without a guardian [1].",
        explanation=["This means the marriage is void [1].", "You must marry again [1]."],
    )
    chat = FakeChat(classified(personalCase=True), [draft])
    retriever = Retriever(index(WUDU, VERSE), FakeEmbedder(), DownMcp())
    answer = await Rafiq(chat, retriever).run("Is my marriage valid?", "en")

    texts = " ".join(getattr(block, "text", "") or "" for block in answer.blocks)
    assert not any(word in texts for word in ("invalid", "void", "must"))
    assert answer.blocks[-1].type == "note"
    assert answer.level == "D"
    assert answer.referral is not None
    assert answer.referral.reason == "personalCase"


# Priority 1: agreement, difference and tarjih in Rafiq's own words.


@pytest.mark.parametrize(
    "sentence",
    [
        "Scholars agree on the core beliefs [1].",
        "Scholars differ on this matter [1].",
        "اختلف العلماء في هذه المسألة [1].",
    ],
)
def test_a_claim_of_agreement_or_difference_needs_a_passage_that_states_it(sentence: str) -> None:
    plain = [book(1, "A passage that explains one view.")]
    assert [p.kind for p in code_problems(parse(sentence), plain)] == ["consensus"]
    stating = [book(1, "Scholars agree, and they differ; اتفق العلماء واختلف العلماء.")]
    assert code_problems(parse(sentence), stating) == []


@pytest.mark.parametrize(
    "sentence",
    [
        "Disagreement is a mercy for the community [1].",
        "Choose what seems closest to the truth [1].",
        "والخلاف رحمة بالأمة [1].",
    ],
)
def test_blessing_a_difference_or_choosing_for_the_reader_fails(sentence: str) -> None:
    passages = [book(1, "Disagreement is a mercy; closest to the truth; الخلاف رحمة.")]
    assert "tarjih" in [p.kind for p in code_problems(parse(sentence), passages)]


# Priority 2.


def test_for_someone_new_the_plain_idea_comes_before_the_term() -> None:
    units = parse("Tawhid means oneness [1]. It is believing that only one God is worshipped [1].")
    first = _plain_first(units, ["Tawhid", "التوحيد"])[0]
    assert first.sentences[0].startswith("It is believing")


def test_an_altered_verse_is_never_repeated_as_a_quotation() -> None:
    units = parse("You quoted «alpha beta gamma» [1]. The verse says something else [1].")
    kept = _without_wording(units, "alpha beta gamma")
    assert kept[0].sentences == ["The verse says something else [1]."]


def test_a_cited_question_and_answer_passage_is_shown_once_after_the_answer() -> None:
    qa = book(2, "The book's own answer.").model_copy(update={"answers_a_question": True})
    units = [*parse("The answer [2]."), *parse("An explanation [2].")]
    for unit in units[1:]:
        unit.role = "explanation"
    shown = _with_book_passage(units, [book(1, "Other."), qa], "en")
    assert [u.block for u in shown] == [None, ("book", "2"), None]
    # Never in another language than the answer, never a passage that cannot be quoted as it is.
    arabic = book(3, "نص الكتاب", lang="ar").model_copy(update={"answers_a_question": True})
    assert [u.block for u in _with_book_passage(parse("The answer [3]."), [arabic], "en")] == [None]
    scrambled = qa.model_copy(update={"quotable": False})
    assert [u.block for u in _with_book_passage(parse("The answer [2]."), [scrambled], "en")] == [
        None
    ]
    assert _with_book_passage(parse("The answer [1]."), [book(1, "Plain.")], "en")[-1].block is None


async def test_asked_whether_a_text_is_a_verse_a_near_match_is_not_found() -> None:
    chat = FakeChat(
        classified(quotedVerse="alpha beta", asksIfQuoted=True, level="A"), [Draft(answer="x")]
    )

    class NearMatch(Retriever):
        async def find_quoted(
            self,
            quote: str,
            language: Language,
            sources: tuple[str, ...] = ("quran",),
            search_language: Language = "ar",
        ) -> tuple[Passage | None, retriever_module.Misquote | None]:
            # The search finds a verse whose words are not the quoted ones.
            return None, retriever_module.Misquote(quoted=quote, ref="2:256", exact=False)

    answer = await Rafiq(chat, NearMatch(index(WUDU, VERSE), FakeEmbedder(), DownMcp())).run(
        "Is «alpha beta» a verse?", "en"
    )
    assert answer.referral is not None
    assert answer.referral.reason == "verseNotFound"


# Priority 3: questions in other languages.


@pytest.mark.parametrize(
    ("text", "plain"),
    [
        ("How many rak'ahs are in each prayer?", True),
        ("كم عدد الركعات؟", True),
        ("Сколько ракаатов в каждой молитве?", False),
        ("Berapa rakaat dalam setiap salat?", False),
        ("Combien de rak'ahs dans chaque prière ?", False),
        ("ہر نماز میں کتنی رکعتیں ہیں؟", False),
    ],
)
def test_only_arabic_and_english_skip_the_normalising_step(text: str, plain: bool) -> None:
    assert _arabic_or_english(text) is plain


class NormalisingChat(FakeChat):
    async def json[T: BaseModel](self, system: str, user: str, schema: type[T]) -> T:
        if schema is Normalized:
            self.systems.append(system)
            self.users.append(user)
            return Normalized(english="How many rak'ahs?", arabic="كم ركعة؟")  # type: ignore[return-value]
        return await super().json(system, user, schema)


async def test_a_question_in_another_language_is_classified_and_searched_with_its_forms() -> None:
    draft = Draft(relevant=[1], answer="You wash your face [1].", explanation=[])
    chat = NormalisingChat(classified(language="other"), [draft])
    retriever = Retriever(index(WUDU, VERSE), FakeEmbedder(), DownMcp())
    await Rafiq(chat, retriever).run("Berapa rakaat dalam setiap salat?", "en")

    classify = next(user for user in chat.users if "Aids for reading" in user)
    assert "in English «How many rak'ahs?»" in classify
    assert "in Arabic «كم ركعة؟»" in classify


# Priority 4: the voice.


async def test_a_religious_answer_starts_with_the_answer_and_ends_without_praise() -> None:
    draft = Draft(
        relevant=[1],
        opening="What a thoughtful question.",
        answer="You wash your face [1].",
        explanation=[],
        encouragement="You are doing so well.",
        followUp="The next lesson is «What breaks wudu».",
    )
    chat = FakeChat(classified(), [draft])
    answer = await Rafiq(chat, Retriever(index(WUDU, VERSE), FakeEmbedder(), DownMcp())).run(
        "How do I perform wudu?", "en"
    )
    assert (answer.opening, answer.encouragement) == (None, None)
    assert answer.follow_up == "The next lesson is «What breaks wudu»."


# The final fixes: question forms and religious formulas in everyday talk.


@pytest.mark.parametrize(
    ("question", "field"),
    [
        ("Is «alpha beta» a verse of the Quran?", "quoted_verse"),
        ("هل «كلمة كلمة» آية من القرآن؟", "quoted_verse"),
        ("Is «alpha beta» a hadith?", "quoted_hadith"),
    ],
)
def test_asking_whether_a_quoted_text_is_a_verse_or_hadith_is_read_from_its_form(
    question: str, field: str
) -> None:
    read = _by_question_form(classified(), question)
    assert read.asks_if_quoted
    assert getattr(read, field)


def test_asking_what_a_quoted_verse_means_is_not_asking_whether_it_is_one() -> None:
    read = _by_question_form(classified(), "What does the verse «alpha beta» mean?")
    assert not read.asks_if_quoted


def test_a_ruling_question_on_a_disputed_matter_is_level_d() -> None:
    assert _by_question_form(classified(level="C"), "Is music haram?").level == "D"
    assert _by_question_form(classified(level="C"), "هل الموسيقى حرام؟").level == "D"
    assert _by_question_form(classified(level="A"), "Is pork haram?").level == "A"
    assert _by_question_form(classified(level="C"), "Why do scholars differ?").level == "C"


@pytest.mark.parametrize(
    ("line", "kept"),
    [
        ("أنا بخير والحمد لله.", "أنا بخير."),
        ("I am well, alhamdulillah.", "I am well."),
        ("وعليكم السلام. أتمنى لك يومًا طيبًا.", "وعليكم السلام. أتمنى لك يومًا طيبًا."),
    ],
)
def test_everyday_talk_returns_a_greeting_but_carries_no_other_formula(
    line: str, kept: str
) -> None:
    assert without_formulas(line) == kept


# Stabilising: attribution, quoted texts, evidence requests, the card with no answer.


@pytest.mark.parametrize(
    "sentence",
    [
        "It is a saying of the Prophet Muhammad [1].",
        "The Prophet (pbuh) said that cleanliness is part of faith [1].",
        "قال رسول الله إن النظافة من الإيمان [1].",
    ],
)
def test_words_are_attributed_to_the_prophet_or_the_quran_only_beside_a_matched_block(
    sentence: str,
) -> None:
    passages = [book(1, "A passage."), hadith(2, 7, "نص", "text")]
    assert "attribution" in [p.kind for p in code_problems(parse(sentence), passages)]
    with_block = [*parse(sentence), Unit("block", block=("hadith", "7"))]
    assert "attribution" not in [p.kind for p in code_problems(with_block, passages)]


async def test_asked_whether_a_text_is_a_verse_with_nothing_to_look_up_it_is_not_found() -> None:
    chat = FakeChat(classified(asksIfQuoted=True, level="A"), [Draft(answer="x [1].")])
    answer = await Rafiq(chat, Retriever(index(WUDU, VERSE), FakeEmbedder(), DownMcp())).run(
        "Is this a verse of the Quran?", "en"
    )
    assert answer.referral is not None
    assert answer.referral.reason in ("verseNotFound", "hadithNotFound")


def test_asking_why_is_not_asking_for_evidence() -> None:
    why = _by_question_form(classified(asksForEvidence=True), "Why does Islam forbid pork?")
    assert not why.asks_for_evidence
    proof = _by_question_form(classified(asksForEvidence=True), "Give me a hadith proving it.")
    assert proof.asks_for_evidence


async def test_a_card_for_want_of_a_source_names_the_lessons_that_cover_the_topic() -> None:
    prayer = WUDU.model_copy(update={"lesson_ids": ["3.3", "3.4"]})
    chat = FakeChat(classified(), [Draft(relevant=[], answer="")])
    answer = await Rafiq(chat, Retriever(index(prayer, VERSE), FakeEmbedder(), DownMcp())).run(
        "How do I perform wudu?", "en"
    )
    assert answer.referral is not None
    assert answer.referral.reason == "noSource"
    assert answer.topic_lesson_ids == ["3.3", "3.4"]


def test_the_support_check_reads_as_much_of_a_passage_as_the_writer() -> None:
    long = book(1, "word " * 1000)
    assert len(_checked(long)) >= len(_passages_text([long]).split("\n", 1)[1]) - 1
