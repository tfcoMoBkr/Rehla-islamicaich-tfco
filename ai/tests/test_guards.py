"""The code guards: the organisers' glossary (translating a term, approved forms in answers),
wording that picks a winner, and verses and hadiths quoted inside a book's text. Fake models only;
the quoted words below are placeholders, not religious texts."""

import json
from pathlib import Path

import pytest

from app.config import REPOSITORY_ROOT
from app.rafiq.check import code_problems
from app.rafiq.compose import compose
from app.rafiq.draft import Unit, parse
from app.rafiq.embedded import NOTE, Quote, place_quotes, quotes_in
from app.rafiq.glossary import Glossary
from app.rafiq.graph import Rafiq, _with_note_before_verse
from app.rafiq.repair import repair
from app.rafiq.schemas import (
    ChatReply,
    Classification,
    Draft,
    HadithBlock,
    NoteBlock,
    TermBlock,
    TextBlock,
)
from app.retrieval import retriever as retriever_module
from app.retrieval.passages import Passage
from app.retrieval.retriever import Retriever

from .fakes import VERSE, WUDU, DownMcp, FakeChat, FakeEmbedder, book, chunk, hadith, index

GLOSSARY = REPOSITORY_ROOT / "content" / "glossary-p7.json"
TAWHID_RULE = next(
    row["rule"]
    for row in json.loads(GLOSSARY.read_text(encoding="utf-8"))["terms"]
    if row["term"] == "التوحيد"
)
TERM_AR = chunk(
    id="term:1:ar",
    lang="ar",
    type="term",
    sourceId="terminologyenc",
    title="توحيد",
    reference="#1",
    url="https://terminologyenc.com/ar/browse/term/1",
    text="توحيد\nالتعريف الشرعي: تعريف كما تنشره الموسوعة.",
    extra={"termId": 1, "definition": "تعريف كما تنشره الموسوعة."},
)
TERM_EN = chunk(
    id="term:1:en",
    type="term",
    sourceId="terminologyenc",
    title="Monotheism",
    reference="#1",
    url="https://terminologyenc.com/en/browse/term/1",
    text='Monotheism\nBrief explanation: "Tawhīd" (monotheism) is explained here. '
    '"Shirk" (association) is its opposite.',
    extra={"termId": 1, "definition": "The definition as the encyclopedia gives it."},
)
PLACEHOLDER_QUOTE = "alpha beta gamma delta epsilon zeta eta"


@pytest.fixture(autouse=True)
def low_threshold(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(retriever_module, "WEAK_COSINE", 0.2)


@pytest.fixture
def glossary(tmp_path: Path) -> Glossary:
    (tmp_path / "glossary-p7.json").write_text(GLOSSARY.read_text(encoding="utf-8"), "utf-8")
    return Glossary.load(tmp_path, index(TERM_AR, TERM_EN, WUDU))


def classified(**fields: object) -> Classification:
    base: dict[str, object] = {"language": "en", "level": "A", "intent": "religious"}
    return Classification.model_validate({**base, **fields})


# The glossary.


def test_the_glossary_is_the_organisers_ten_rows_with_terminologyencs_names(
    glossary: Glossary,
) -> None:
    assert len(glossary.concepts) == 10
    tawhid = glossary.find("Translate the word «التوحيد» into English.")
    assert tawhid is not None
    assert tawhid.approved == "Tawhid / Oneness of God"
    # The entry's title and the name it gives its own term; not the name of its opposite.
    assert tawhid.renderings == ("Monotheism",)
    assert tawhid.definitions["en"].text == "The definition as the encyclopedia gives it."
    assert glossary.find("What is Tawhid in English?") is tawhid
    assert glossary.find("How do I perform wudu?") is None


async def test_translating_a_glossary_term_is_answered_from_the_glossary_not_a_model(
    glossary: Glossary,
) -> None:
    chat = FakeChat(classified(termTranslation="التوحيد"), [Draft(answer="unused")])
    retriever = Retriever(index(WUDU, VERSE), FakeEmbedder(), DownMcp())
    answer = await Rafiq(chat, retriever, glossary=glossary).run(
        "Translate the word «التوحيد» into English.", "en"
    )

    block = answer.blocks[0]
    assert isinstance(block, TermBlock)
    assert (block.term, block.approved, block.rule) == (
        "التوحيد",
        "Tawhid / Oneness of God",
        TAWHID_RULE,
    )
    assert block.definition == "The definition as the encyclopedia gives it."
    assert [source.source_id for source in answer.sources] == [
        "organisers-glossary",
        "terminologyenc",
    ]
    assert not answer.referred
    assert not any("Passages:" in user for user in chat.users)
    assert answer.encouragement is None


async def test_a_term_the_glossary_does_not_have_goes_through_the_sources(
    glossary: Glossary,
) -> None:
    draft = Draft(relevant=[1], answer="You wash your face, arms and feet [1].", explanation=[])
    chat = FakeChat(classified(termTranslation="wudu"), [draft])
    retriever = Retriever(index(WUDU, VERSE), FakeEmbedder(), DownMcp())
    answer = await Rafiq(chat, retriever, glossary=glossary).run("Translate wudu.", "en")
    assert not any(isinstance(block, TermBlock) for block in answer.blocks)
    assert any("Passages:" in user for user in chat.users)


def test_a_concept_named_only_by_another_rendering_gets_its_approved_form(
    glossary: Glossary,
) -> None:
    units, replaced = glossary.in_approved_form(parse("Islam rests on monotheism [1]."), "en")
    assert units[0].sentences == ["Islam rests on Tawhid / Oneness of God [1]."]
    assert replaced == 2

    complete = parse("Tawhid / Oneness of God is taught first [1]. Tawhid is the base [1].")
    assert glossary.in_approved_form(complete, "en") == (complete, 0)
    # The first mention gets the whole approved form, once; a later rendering becomes the term.
    half = parse("Tawhid is taught first [1]. Monotheism is the base [1].")
    units, replaced = glossary.in_approved_form(half, "en")
    assert replaced == 2
    assert units[0].sentences == [
        "Tawhid / Oneness of God is taught first [1].",
        "Tawhid is the base [1].",
    ]
    arabic = parse("التوحيد أول ما يتعلمه المسلم [1].")
    assert glossary.in_approved_form(arabic, "ar") == (arabic, 0)


async def test_the_model_is_given_the_approved_forms_of_the_terms_it_may_name(
    glossary: Glossary,
) -> None:
    draft = Draft(relevant=[1], answer="Islam rests on monotheism [1].", explanation=[])
    chat = FakeChat(classified(), [draft])
    retriever = Retriever(index(WUDU, VERSE, TERM_EN), FakeEmbedder(), DownMcp())
    answer = await Rafiq(chat, retriever, glossary=glossary).run("What is monotheism?", "en")

    assert "- التوحيد: Tawhid / Oneness of God" in "\n".join(chat.systems)
    texts = [block.text for block in answer.blocks if isinstance(block, TextBlock)]
    assert any("Tawhid / Oneness of God" in text for text in texts)
    assert not any("monotheism" in text for text in texts)


# Wording that picks a winner.


def test_picking_a_winner_is_removed_from_rafiqs_words_but_a_verbatim_block_may_say_it() -> None:
    passages = [book(1, "Some say one thing and some another.")]
    units = parse("Some say one thing [1]. The correct view is the first one [1].")
    problems = code_problems(units, passages)
    assert [problem.kind for problem in problems] == ["tarjih"]
    repaired = repair(units, problems, passages)
    assert repaired is not None
    assert [s for unit in repaired for s in unit.sentences] == ["Some say one thing [1]."]

    quoted = [hadith(1, 7, "نص", "The correct view, as the source words it.")]
    assert code_problems([Unit("block", block=("hadith", "7"))], quoted) == []


# Verses and hadiths inside a book's text.


def test_quotes_inside_a_book_are_found_by_how_books_write_them() -> None:
    text = (
        f"The Prophet (pbuh) said: “{PLACEHOLDER_QUOTE}”. "
        f"A Companion (may Allah be pleased with him) said: “{PLACEHOLDER_QUOTE} theta”. "
        f"It is written: {{{PLACEHOLDER_QUOTE} iota}} [Ch. 2, Verse 256]. "
        f"Allah says: “{PLACEHOLDER_QUOTE} kappa”."
    )
    assert quotes_in(text) == [
        Quote("hadith", PLACEHOLDER_QUOTE),
        Quote("quran", f"{PLACEHOLDER_QUOTE} iota", (2, 256)),
        Quote("quran", f"{PLACEHOLDER_QUOTE} kappa"),
    ]
    assert quotes_in("قال رسول الله ﷺ: «كلمة كلمة كلمة كلمة كلمة»") == [
        Quote("hadith", "كلمة كلمة كلمة كلمة كلمة")
    ]


QUOTING_BOOK = book(1, f"The Prophet (pbuh) said: “{PLACEHOLDER_QUOTE}”. That is the point.")


async def test_a_hadith_the_answer_carries_from_a_book_is_shown_from_hadeethenc() -> None:
    found = hadith(9, 42, "نص الحديث", PLACEHOLDER_QUOTE)
    asked: list[Quote] = []

    async def match(quote: Quote) -> Passage | None:
        asked.append(quote)
        return found

    units = parse(f"It teaches this [1]. As the book says, {PLACEHOLDER_QUOTE} [1].")
    placed, passages = await place_quotes(units, [QUOTING_BOOK], match)
    assert asked == [Quote("hadith", PLACEHOLDER_QUOTE)]
    assert [(unit.kind, unit.sentences, unit.block) for unit in placed] == [
        ("paragraph", ["It teaches this [1]."], None),
        ("block", [], ("hadith", "42")),
    ]
    assert [p.n for p in passages] == [1, 2]
    blocks = compose(placed, passages, "en", "A").blocks
    assert isinstance(blocks[1], HadithBlock)
    assert blocks[1].grade == "Graded"


async def test_a_hadith_no_entry_matches_stays_with_a_line_that_its_grade_is_not_stated() -> None:
    async def nothing(quote: Quote) -> Passage | None:
        return None

    units = parse(f"As the book says, {PLACEHOLDER_QUOTE} [1].")
    placed, passages = await place_quotes(units, [QUOTING_BOOK], nothing)
    assert [unit.block for unit in placed] == [None, NOTE]
    assert placed[0].sentences == units[0].sentences
    assert compose(placed, passages, "en", "A").blocks[1] == NoteBlock(note="gradeNotStated")


async def test_a_verse_a_book_quotes_with_its_reference_is_replaced_by_quranencs_block() -> None:
    quoting = book(1, f"It is written: {{{PLACEHOLDER_QUOTE}}} [Ch. 2, Verse 256].")
    asked: list[Quote] = []

    async def match(quote: Quote) -> Passage | None:
        asked.append(quote)
        return None

    await place_quotes(parse(f"It says {PLACEHOLDER_QUOTE} [1]."), [quoting], match)
    assert asked == [Quote("quran", PLACEHOLDER_QUOTE, (2, 256))]


class QuoteRetriever(Retriever):
    """Finds every book quote at a stored hadith, as the approved sources' search would."""

    def __init__(self, found: Passage) -> None:
        book_chunk = chunk(
            id="book:q:1", text=f"The Prophet (pbuh) said: “{PLACEHOLDER_QUOTE}”. A lesson."
        )
        super().__init__(index(book_chunk, VERSE), FakeEmbedder(), DownMcp())
        self.found = found

    async def match_quote(
        self, kind: str, quote: str, language: str, ref: tuple[int, int] | None = None
    ) -> Passage | None:
        return self.found


async def test_in_the_pipeline_the_carried_hadith_becomes_its_block_with_its_grade() -> None:
    draft = Draft(
        relevant=[1],
        answer="The Prophet taught a lesson [1].",
        explanation=[f"The book quotes him: {PLACEHOLDER_QUOTE} [1]."],
    )
    chat = FakeChat(classified(), [draft])
    found = hadith(0, 42, "نص الحديث", PLACEHOLDER_QUOTE)
    answer = await Rafiq(chat, QuoteRetriever(found)).run("What did the Prophet teach?", "en")

    hadiths = [block for block in answer.blocks if isinstance(block, HadithBlock)]
    assert [block.id for block in hadiths] == [42]
    texts = " ".join(block.text for block in answer.blocks if isinstance(block, TextBlock))
    assert PLACEHOLDER_QUOTE not in texts


async def test_a_term_translation_seen_as_everyday_help_is_still_answered_from_the_glossary(
    glossary: Glossary,
) -> None:
    chat = FakeChat(
        classified(intent="talk", talk=True, talkKind="practical", termTranslation="التوحيد"),
        [Draft(answer="unused")],
    )
    retriever = Retriever(index(WUDU, VERSE), FakeEmbedder(), DownMcp())
    answer = await Rafiq(chat, retriever, glossary=glossary).run(
        "Translate the word «التوحيد» into English.", "en"
    )
    assert isinstance(answer.blocks[0], TermBlock)


async def test_a_message_with_no_arabic_of_its_own_is_not_answered_in_arabic(
    glossary: Glossary,
) -> None:
    chat = FakeChat(classified(language="ar", termTranslation="التوحيد"), [Draft(answer="x")])
    retriever = Retriever(index(WUDU, VERSE), FakeEmbedder(), DownMcp())
    rafiq = Rafiq(chat, retriever, glossary=glossary)
    english = await rafiq.run("Translate the word «التوحيد» into English.", "en")
    assert english.language == "en"
    arabic = await rafiq.run("ترجم كلمة «التوحيد» إلى الإنجليزية.", "en")
    assert arabic.language == "ar"


async def test_asking_what_a_term_means_is_answered_from_the_sources(glossary: Glossary) -> None:
    draft = Draft(relevant=[1], answer="You wash your face, arms and feet [1].", explanation=[])
    chat = FakeChat(classified(termTranslation="التوحيد", plainTerm=True), [draft])
    retriever = Retriever(index(WUDU, VERSE), FakeEmbedder(), DownMcp())
    answer = await Rafiq(chat, retriever, glossary=glossary).run(
        "What does «التوحيد» mean, for someone who never heard it?", "en"
    )
    assert not any(isinstance(block, TermBlock) for block in answer.blocks)
    assert any("Passages:" in user for user in chat.users)


def test_a_verse_quoted_in_other_words_opens_with_a_fixed_line_then_the_verse() -> None:
    units = [*parse("The verse means:"), Unit("block", block=("quran", "2:256"))]
    noted = _with_note_before_verse(units, "2:256")
    assert [unit.block for unit in noted] == [("note", "wordingDiffers"), ("quran", "2:256"), None]
    passages = [hadith(9, 1, "نص", "text")]
    assert NoteBlock(note="wordingDiffers") in compose(noted, passages, "en", "A").blocks


async def test_the_everyday_part_of_a_message_is_answered_even_when_the_draft_left_it_out() -> None:
    draft = Draft(relevant=[1], answer="You wash your face, arms and feet [1].", explanation=[])
    chat = FakeChat(
        classified(talk=True, religiousPart="How do I perform wudu?"),
        [draft],
        chat=ChatReply.model_validate(
            {"reply": "Being nervous at the start is normal.", "next": ""}
        ),
    )
    retriever = Retriever(index(WUDU, VERSE), FakeEmbedder(), DownMcp())
    answer = await Rafiq(chat, retriever).run("I'm nervous. How do I perform wudu?", "en")
    assert answer.opening is not None
    assert "Being nervous at the start is normal" in answer.opening
    assert any("is answered separately, from the sources" in user for user in chat.users)
