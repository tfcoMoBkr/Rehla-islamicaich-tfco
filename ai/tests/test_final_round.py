"""The final round's rules, with fake models: Rafiq talks by default, the sourced path only for
the religious part; no greeting returned that was not given; no phrasing repeated from earlier
replies; what to study next is conversation with the lesson's link; quoted words presented as a
verse are always looked up."""

import pytest
from pydantic import BaseModel

from app.rafiq.check import code_problems, quoted_from, without_worship_words, worship_words
from app.rafiq.compose import source_card
from app.rafiq.draft import explanation_units, parse
from app.rafiq.graph import (
    Rafiq,
    _answer_first,
    _answered,
    _by_plan,
    _by_question_form,
    quoted_words,
)
from app.rafiq.repair import repair
from app.rafiq.road import Road
from app.rafiq.schemas import ChatReply, Classification, Draft, TopicLessons, Turn
from app.rafiq.voice import voiced
from app.retrieval import retriever as retriever_module
from app.retrieval.retriever import Retriever, _contains

from .fakes import VERSE, WUDU, DownMcp, FakeChat, FakeEmbedder, book, index, verse

ROAD = Road(
    [
        {
            "station": "2",
            "title": {"ar": "الطهارة", "en": "Purity"},
            "lessons": [
                {"id": "2.2", "title": {"ar": "الوضوء", "en": "Wudu"}},
                {"id": "2.3", "title": {"ar": "الغسل", "en": "Ghusl"}},
            ],
        }
    ]
)


@pytest.fixture(autouse=True)
def low_threshold(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(retriever_module, "WEAK_COSINE", 0.2)


def classified(**fields: object) -> Classification:
    base: dict[str, object] = {"language": "ar", "level": "A", "intent": "religious"}
    return Classification.model_validate({**base, **fields})


def rafiq(chat: FakeChat) -> Rafiq:
    retriever = Retriever(index(WUDU, VERSE), FakeEmbedder(), DownMcp())
    return Rafiq(chat, retriever, road=ROAD)


def passages_asked(chat: FakeChat) -> bool:
    return any("Passages:" in user for user in chat.users)


# Conversation is the default.


async def test_a_general_question_is_conversation_never_a_card() -> None:
    chat = FakeChat(
        classified(intent="offtopic", language="en"),
        [Draft()],
        chat=ChatReply(opening="A short walk after work often helps."),
    )
    answer = await rafiq(chat).run("I'm tired after work, any tips?", "en")
    assert answer.kind == "chat"
    assert answer.referral is not None
    assert answer.referral.reason == "smalltalk"
    assert answer.blocks == []
    assert answer.sources == []
    assert not passages_asked(chat)


async def test_a_feeling_gets_a_warm_reply_and_no_greeting_that_was_not_given() -> None:
    chat = FakeChat(
        classified(intent="feelings", talk=True, talkKind="feelings"),
        [Draft()],
        chat=ChatReply(
            opening="وعليكم السلام. التوتر في البداية يثقل على أي أحد. ما الذي يقلقك أكثر؟"
        ),
    )
    answer = await rafiq(chat).run("انا متوتر جدا ي صديقييي اريدك ان تشجعني", "ar")
    assert answer.kind == "chat"
    assert "وعليكم السلام" not in (answer.opening or "")
    assert "التوتر في البداية" in (answer.opening or "")
    assert answer.lesson_id is None


def test_a_greeting_is_returned_only_when_it_was_given() -> None:
    lines = {"talk": "وعليكم السلام. كيف كان يومك؟"}
    assert (
        "وعليكم السلام"
        in voiced(lines, [], "ar", opening="talk", asked="السلام عليكم يا رفيق")["talk"]
    )
    assert "وعليكم" not in voiced(lines, [], "ar", opening="talk", asked="كيف حالك؟")["talk"]
    english = {"talk": "Wa alaykum as-salam! How was work?"}
    assert "alaykum" not in voiced(english, [], "en", opening="talk", asked="hi")["talk"]


def test_no_phrasing_repeated_from_any_earlier_reply_referral_openings_included() -> None:
    history = [
        Turn(role="user", text="أنا قلق"),
        Turn(role="assistant", text="أتفهم شعورك بالقلق. خذ وقتك في هذا الأمر."),
        Turn(role="user", text="شكرًا"),
        Turn(role="assistant", text="على الرحب والسعة."),
    ]
    lines = {"opening": "أتفهم قلقك من هذا الأمر. هذا سؤال يستحق أن يسمعه مختص."}
    assert voiced(lines, history, "ar")["opening"] == "هذا سؤال يستحق أن يسمعه مختص."
    again = {"opening": "هذا جديد. خذ وقتك في هذا الأمر."}
    assert voiced(again, history, "ar")["opening"] == "هذا جديد."


# What to study next.


async def test_what_to_study_next_is_conversation_with_the_named_lessons_link() -> None:
    chat = FakeChat(
        classified(religiousPart="ماذا أتعلم بعد درس الوضوء؟"),
        [Draft()],
        chat=ChatReply.model_validate(
            {"reply": "بعد الوضوء يأتي درس «الغسل»، فهو يكمل باب الطهارة.", "lesson": "2.3"}
        ),
    )
    answer = await rafiq(chat).run("ماذا أتعلم بعد درس الوضوء؟", "ar")
    assert answer.kind == "chat"
    assert answer.lesson_id == "2.3"
    assert not passages_asked(chat)
    assert "- 2.3: الغسل" in next(system for system in chat.systems if "Their road" in system)


async def test_a_lesson_link_needs_the_sentence_that_names_it() -> None:
    chat = FakeChat(
        classified(intent="talk", talk=True, talkKind="planning"),
        [Draft()],
        chat=ChatReply.model_validate({"reply": "تابع طريقك بهدوء.", "lesson": "2.3"}),
    )
    answer = await rafiq(chat).run("ماذا أفعل الآن؟", "ar")
    assert answer.lesson_id is None


def test_the_plan_rule_reads_the_question_in_both_languages() -> None:
    religious = classified(religiousPart="x")
    assert _by_plan(religious, "What should I study after the wudu lesson?").intent == "talk"
    assert _by_plan(religious, "ماذا أتعلم بعد درس الوضوء؟").religious_part is None
    assert _by_plan(religious, "ما فضل الوضوء؟").intent == "religious"


# Quoted words presented as a verse.


@pytest.mark.parametrize(
    ("question", "quoted"),
    [
        ("ما معنى قوله تعالى: «لا إكراه في الإسلام»؟", "لا إكراه في الإسلام"),
        ("What does the verse «لا إكراه في الإسلام» mean?", "لا إكراه في الإسلام"),
        (
            'What does the verse "there is no compulsion in Islam" mean?',
            "there is no compulsion in Islam",
        ),
        ("ما معنى قوله تعالى: لا إكراه في الإسلام؟", "لا إكراه في الإسلام"),
    ],
)
def test_quoted_words_presented_as_a_verse_are_always_looked_up(question: str, quoted: str) -> None:
    assert quoted_words(question) == quoted
    found = _by_question_form(classified(), question)
    assert found.quoted_verse == quoted
    assert found.asks_if_quoted is False


def test_asked_as_is_it_a_verse_the_lookup_decides() -> None:
    found = _by_question_form(classified(), "هل «النظافة من الإيمان» آية؟")
    assert (found.quoted_verse, found.asks_if_quoted) == ("النظافة من الإيمان", True)


# Words of worship are never written by the model.


@pytest.mark.parametrize(
    "sentence",
    [
        "ثم تقول: سبحانك اللهم وبحمدك [1].",
        "Then you say: Glory be to You, O Allah, and praise [1].",
        "You start with Allahu Akbar [1].",
        "Then say Subhanaka Allahumma wa bihamdika [1].",
        "Puis dites : Gloire à Toi, ô Allah [1].",
    ],
)
def test_words_of_worship_in_the_prose_are_found_in_any_language(sentence: str) -> None:
    assert worship_words(sentence) is not None


def test_naming_the_step_or_what_the_learner_wrote_is_not_writing_worship_words() -> None:
    assert worship_words("Then you say the opening supplication [1].") is None
    assert worship_words("ثم تقرأ دعاء الاستفتاح [1].") is None
    assert (
        worship_words("«الله أكبر» means that Allah is greater [1].", "ما معنى الله أكبر؟") is None
    )


def test_a_sentence_with_typed_worship_words_is_removed_and_the_rest_stays() -> None:
    passages = [book(1, "Begin with the opening takbir, then the opening supplication.")]
    units = [
        *parse("You begin with the takbir [1]."),
        *parse("Then you say: Glory be to You, O Allah, and praise [1]."),
    ]
    problems = code_problems(units, passages, language="en")
    assert [problem.kind for problem in problems] == ["worshipWords"]
    repaired = repair(units, problems, passages, language="en")
    assert repaired is not None
    assert "Glory be" not in " ".join(" ".join(unit.sentences) for unit in repaired)
    assert "takbir" in " ".join(" ".join(unit.sentences) for unit in repaired)


# Amounts come from a cited passage, about the thing counted.

TWELVE = (
    "Every muslim is recommended to pray 12 Rakaat of supererogatory prayers every day: four "
    "before noon prayer, two after it, two after Maghrib prayer, two after Isha."
)


def test_an_amount_the_cited_passage_does_not_state_for_that_thing_is_removed() -> None:
    passages = [book(1, TWELVE)]
    units = parse("Dhuhr has four rak'ahs [1]. Maghrib has three rak'ahs [1].")
    problems = code_problems(
        units, passages, language="en", asked="How many rak'ahs in each prayer?", counted=["rak'ah"]
    )
    kinds = [problem.kind for problem in problems]
    assert kinds.count("amount") == 2
    assert "noAmount" in kinds


def test_an_amount_in_another_language_than_the_reply_is_not_stated() -> None:
    passages = [book(1, "Maghrib has three rak'ahs.", "en")]
    units = parse("المغرب ثلاث ركعات [1].")
    problems = code_problems(
        units, passages, language="ar", asked="كم ركعة في المغرب؟", counted=["rak'ah", "ركعة"]
    )
    assert {problem.kind for problem in problems} >= {"amount", "noAmount"}


def test_an_amount_the_passage_states_answers_and_other_numbers_do_not_count() -> None:
    passages = [book(1, "Maghrib has three rak'ahs. There are five daily prayers.")]
    stated = parse("Maghrib has three rak'ahs [1].")
    asked = "How many rak'ahs in Maghrib?"
    assert code_problems(stated, passages, language="en", asked=asked, counted=["rak'ah"]) == []
    elsewhere = parse("There are five daily prayers [1].")
    kinds = [
        p.kind
        for p in code_problems(elsewhere, passages, language="en", asked=asked, counted=["rak'ah"])
    ]
    assert kinds == ["noAmount"]


async def test_a_no_source_card_links_the_lessons_chosen_by_topic() -> None:
    class TopicChat(FakeChat):
        async def json[T: BaseModel](self, system: str, user: str, schema: type[T]) -> T:
            if schema is TopicLessons:
                self.systems.append(system)
                return TopicLessons(lessons=["2.3", "9.9"])  # type: ignore[return-value]
            return await super().json(system, user, schema)

    chat = TopicChat(classified(searchPhrases=["ghusl"]), [Draft(adequate=False)])
    answer = await rafiq(chat).run("What is ghusl?", "ar")
    assert answer.referral is not None
    assert answer.referral.reason == "noSource"
    assert answer.topic_lesson_ids == ["2.3"]


# The source card in the answer's language, and the direct answer first.


def test_a_book_cited_in_another_language_shows_the_edition_in_the_answers_language() -> None:
    english = book(1, "Fasting is abstaining from food.").model_copy(
        update={"url": "https://byenah.com/en/muslim-content/4784", "title": "New Muslim Guideline"}
    )
    card = source_card(1, english, "ar")
    assert (card.title, card.url) == (
        "المختصر المفيد للمسلم الجديد",
        "https://islamhouse.com/ar/books/2831443/",
    )
    assert source_card(1, english, "en").url == "https://byenah.com/en/muslim-content/4784"


def test_a_draft_without_a_direct_answer_leads_with_its_first_explanation_sentence() -> None:
    units = explanation_units(["Islam spread through invitation. People met Muslims in trade [1]."])
    assert not _answered(units)
    first = _answer_first(units)
    assert first[0].role == "answer"
    assert first[0].sentences == ["Islam spread through invitation.[1]"]
    assert _answered(first)


def test_a_few_words_of_a_verse_in_quotation_marks_are_its_text_and_not_rafiqs() -> None:
    passages = [verse(1, "2:256", "لَآ إِكۡرَاهَ فِي ٱلدِّينِۖ قَد تَّبَيَّنَ ٱلرُّشۡدُ مِنَ ٱلۡغَيِّ", None)]
    assert quoted_from("الآية تقول: «لا إكراه في الدين» [1].", passages) == 1
    assert quoted_from("الآية تنهى عن إكراه أحد على الدين [1].", passages) is None


def test_the_closing_words_of_the_prayer_are_words_of_worship() -> None:
    assert worship_words('ثم تسلم بقول "السلام عليكم ورحمة الله" [1].') is not None
    assert worship_words("Then say: peace and mercy of Allah be upon you [1].") is not None


def test_the_lesson_to_study_next_is_read_from_the_lesson_map() -> None:
    after_wudu = ROAD.planned("ماذا أتعلم بعد درس الوضوء؟", None)
    by_progress = ROAD.planned("What should I study next?", ["2.2"])
    assert after_wudu is not None
    assert by_progress is not None
    assert (after_wudu.id, by_progress.id) == ("2.3", "2.3")


def test_typed_words_of_worship_are_cut_and_the_step_they_belong_to_stays() -> None:
    assert without_worship_words('ثم تركع وتقول في ركوعك: "سبحان ربي العظيم". [2][8]') == (
        "ثم تركع [2][8]."
    )
    assert without_worship_words("ثم تكبر وتقول الله أكبر [1].") == "ثم تكبر [1]."
    assert without_worship_words('بعد السجود الأول، تجلس وتقول: "ربي اغفر لي". [5]') == (
        "بعد السجود الأول، تجلس [5]."
    )
    assert without_worship_words("«سبحانك اللهم» [1].") is None


def test_a_verse_in_ordinary_spelling_is_the_verse_in_the_qurans_script() -> None:
    assert _contains("ٱلۡحَمۡدُ لِلَّهِ رَبِّ ٱلۡعَٰلَمِينَ", "الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ")
    assert not _contains("لَآ إِكۡرَاهَ فِي ٱلدِّينِۖ", "لا إكراه في الإسلام")


def test_the_voluntary_amount_does_not_answer_a_question_about_the_obligatory_one() -> None:
    passages = [book(1, "Every Muslim is recommended to pray twelve voluntary rak'ahs a day.")]
    units = parse("Muslims pray twelve voluntary rak'ahs a day [1].")
    asked = "How many rak'ahs in each prayer? How many rak'ahs in each obligatory prayer?"
    kinds = [p.kind for p in code_problems(units, passages, None, "en", asked, ["rak'ah"])]
    assert kinds == ["amount", "noAmount"]


def test_a_question_naming_neither_form_is_not_answered_by_the_voluntary_amount() -> None:
    passages = [book(1, "Every Muslim is recommended to pray twelve voluntary rak'ahs a day.")]
    units = parse("Muslims pray twelve voluntary rak'ahs a day [1].")
    asked = "How many rak'ahs are in each prayer?"
    kinds = [p.kind for p in code_problems(units, passages, None, "en", asked, ["rak'ah"])]
    assert kinds == ["amount", "noAmount"]


def test_the_form_of_an_amount_is_read_from_its_whole_paragraph() -> None:
    passages = [book(1, "Twelve voluntary rak'ahs: four rak'ahs before Dhuhr and two after it.")]
    units = parse("These are voluntary rak'ahs [1]. There are four rak'ahs before Dhuhr [1].")
    asked = "How many rak'ahs are in each prayer?"
    kinds = [p.kind for p in code_problems(units, passages, None, "en", asked, ["rak'ah"])]
    assert "noAmount" in kinds


def test_a_cut_step_keeps_no_dangling_verb_of_saying() -> None:
    assert without_worship_words('بعد ذلك، تقرأ دعاء الاستفتاح، مثل قول: "سبحانك اللهم". [2]') == (
        "بعد ذلك، تقرأ دعاء الاستفتاح [2]."
    )
    assert without_worship_words('ثم تركع وتقول في ركوعك: "سبحان ربي العظيم". [2]') == (
        "ثم تركع [2]."
    )


def test_the_form_is_read_from_the_whole_reply_and_without_vowel_signs() -> None:
    passages = [book(1, "يُستحب أن يصلي اثنتي عشرة ركعة: أربع ركعات قبل الظهر.", "ar")]
    units = [
        *parse("يُستحب للمسلم أن يصلي اثنتي عشرة ركعة [1]."),
        *explanation_units(["هي أربع ركعات قبل الظهر [1]."]),
    ]
    kinds = [
        p.kind for p in code_problems(units, passages, None, "ar", "كم ركعة في كل صلاة؟", ["ركعة"])
    ]
    assert "noAmount" in kinds
