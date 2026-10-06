"""Draft answers in every shape a model may write, through what verify does on the last attempt:
code checks, repair, the support verdict, then finishing and composing. No model is called.

Each case states the problem categories found and the outcome; every answer that is shown is then
held to the guarantees: every claim covered by a source, no sacred words in the prose, at most two
verse or hadith blocks, each exactly as published.
"""

from dataclasses import dataclass, field

import pytest

from app.rafiq.check import (
    COPIED_RUN_ARABIC_SCRIPT,
    COPIED_RUN_OTHER,
    MIN_CITED_WORDS,
    Problem,
    cited,
    code_problems,
    is_lead_in,
)
from app.rafiq.compose import compose
from app.rafiq.draft import parse
from app.rafiq.repair import MAX_BLOCKS, finish, repair
from app.rafiq.schemas import HadithBlock, QuranBlock, RafiqAnswer, TextBlock
from app.retrieval.passages import Passage
from app.text import has_arabic, words

from .fakes import book, hadith, term, verse

NARRATION_EN = (
    "The narrator reported that the speaker said these exact published words "
    "of the first narration today."
)
NARRATION_AR = "عن الراوي قال قال المتكلم هذه الكلمات المنشورة بعينها للرواية الأولى اليوم"
VERSE_AR = "هذه كلمات آية منشورة بنصها الكامل مع علامات التشكيل للاختبار فقط"
VERSE_EN = "These are the published words of a verse translation used only for this test here."

PASSAGES: list[Passage] = [
    book(1, "The first passage describes the opening part of the topic in plain words."),
    book(2, "The second passage lists three parts: the first, the second and the third part."),
    hadith(3, 101, NARRATION_AR, NARRATION_EN),
    verse(4, "2:255", VERSE_AR, VERSE_EN),
    term(5, "Term: its meaning in plain words, as the terminology source gives it."),
    hadith(6, 102, "نص عربي منشور لرواية ثانية مختلفة تماما عن الأولى", "A second narration."),
    hadith(7, 103, "نص عربي منشور لرواية ثالثة لا تشبه غيرها", "A third narration."),
]


@dataclass
class Shape:
    draft: str
    found: set[str] = field(default_factory=set)
    outcome: str = "shown"  # "shown" or "referred"
    blocks: list[tuple[str, str]] = field(default_factory=list)
    required: str | None = None
    extractive: bool = False
    # Sentence numbers (as the model check lists cited sentences) it finds unsupported.
    unsupported: tuple[int, ...] = ()
    text_has: tuple[str, ...] = ()
    text_lacks: tuple[str, ...] = ()


SHAPES: dict[str, Shape] = {
    "single paragraph": Shape(
        "The first passage describes the opening part [1]. It uses plain words for it [1]."
    ),
    "several paragraphs": Shape(
        "The first passage describes the opening part [1].\n\n"
        "The second passage gives the three parts of it [2]."
    ),
    "numbered list": Shape(
        "The parts are these:\n1. The first part of the topic [2]\n"
        "2. The second part of the topic [2]\n3. The third part of the topic [2]"
    ),
    "bullets": Shape(
        "The parts are these:\n- The first part of the topic [2]\n"
        "- The second part of the topic [2]\n- The third part of the topic [2]"
    ),
    "list introduction of eleven words": Shape(
        "According to the second passage the topic has these three separate parts:\n"
        "- The first part of the topic [2]\n- The second part of the topic [2]"
    ),
    "marker closing the paragraph only": Shape(
        "The first passage describes the opening part. It says so in plain words for "
        "the reader. That is all it says about the opening [1]."
    ),
    "marker closing a list item only": Shape(
        "The parts are these:\n- The first part comes first. It opens the topic [2]\n"
        "- The second part follows it [2]"
    ),
    "marker missing on one sentence": Shape(
        "The first passage describes the opening part [1].\n\n"
        "This extra sentence has no source behind it at all.",
        found={"unmarked"},
        text_lacks=("This extra sentence",),
    ),
    "hadith words retold in prose": Shape(
        "The narration speaks of the topic [3]. The speaker said these exact published "
        "words of the first narration today [3].",
        found={"copiedSacred"},
        blocks=[("hadith", "101")],
        text_lacks=("exact published words",),
    ),
    "only a retold hadith, before its own block": Shape(
        "The narrator reported that the speaker said these exact published words [3].\n"
        "{{hadith:101}}",
        found={"copiedSacred"},
        blocks=[("hadith", "101")],
    ),
    "only a retold hadith, with no block": Shape(
        "The speaker said these exact published words of the first narration today [3].",
        found={"copiedSacred"},
        blocks=[("hadith", "101")],
    ),
    "hadith words in Arabic retold": Shape(
        "The narration speaks of the topic [3]. It says: قال المتكلم هذه الكلمات المنشورة "
        "بعينها للرواية الأولى اليوم [3].",
        found={"copiedSacred"},
        blocks=[("hadith", "101")],
    ),
    "verse written in brackets": Shape(
        "The verse is about the topic [4]. It says ﴿هذه كلمات آية منشورة بنصها الكامل مع "
        "علامات التشكيل﴾ [4].",
        found={"copiedSacred", "verseBrackets"},
        blocks=[("quran", "2:255")],
        text_lacks=("﴿",),
    ),
    "brackets around words from no passage": Shape(
        "The first passage describes the opening part [1]. A verse says ﴿كلام لم يرد في "
        "أي مقطع من المقاطع هنا﴾ [1].",
        found={"verseBrackets"},
        text_lacks=("﴿",),
    ),
    "two hadiths": Shape(
        "Two narrations speak of the topic [3][6].\n{{hadith:101}}\n{{hadith:102}}",
        blocks=[("hadith", "101"), ("hadith", "102")],
    ),
    "three hadiths, the two most relevant kept": Shape(
        "Three narrations speak of the topic [7][6][3].\n{{hadith:103}}\n{{hadith:102}}\n"
        "{{hadith:101}}",
        blocks=[("hadith", "101"), ("hadith", "102")],
    ),
    "hadith relied on but not shown": Shape(
        "The narration says that the topic matters [3].",
        blocks=[("hadith", "101")],
    ),
    "verse relied on but not shown": Shape(
        "The verse speaks about the topic in general [4].",
        blocks=[("quran", "2:255")],
    ),
    "term definition": Shape(
        "In plain words, it means the first meaning the term source gives [5]. "
        "This is called the term [5]."
    ),
    # A quoted word that no shown block, cited passage or question holds is not Rafiq's to quote.
    "mixed Arabic and English": Shape(
        "The book calls it «الموضوع» in Arabic, and the passage explains it [1].",
        found={"quoted"},
        text_lacks=("«الموضوع»",),
    ),
    "combined markers": Shape(
        "This rests on the first two passages [1, 2]. And on these two as well [1،2]."
    ),
    "marker after the full stop": Shape(
        "The first passage describes the opening part. [1] The second passage gives its parts. [2]"
    ),
    "marker that points nowhere": Shape(
        "The first passage describes the opening part [1]. This sentence points to nothing [9].",
        found={"unknownMarker"},
        text_lacks=("points to nothing",),
    ),
    "placeholder that points nowhere": Shape(
        "The first passage describes the opening part [1].\n{{hadith:999}}",
        found={"unknownBlock"},
    ),
    "nothing cited": Shape(
        "This sentence has no source behind it.\n\nNeither does this one at all.",
        found={"unmarked"},
        outcome="referred",
    ),
    "misquoted verse not shown": Shape(
        "The wording you quoted differs from the verse [4].",
        found={"missingVerse"},
        blocks=[("quran", "2:255")],
        required="2:255",
    ),
    "unsupported sentence": Shape(
        "The first passage describes the opening part [1]. It also claims something it "
        "never says [1].",
        found={"unsupported"},
        unsupported=(2,),
        text_lacks=("never says",),
    ),
    "everything unsupported": Shape(
        "The first passage claims something it never says [1].",
        found={"unsupported"},
        unsupported=(1,),
        outcome="referred",
    ),
    "extractive answer trimmed to two sentences": Shape(
        "The narration speaks of the topic [3]. It is published in this language [3]. "
        "A third sentence of the model's own [3].",
        blocks=[("hadith", "101")],
        extractive=True,
        text_lacks=("third sentence",),
    ),
    "answer in Arabic": Shape(
        "يصف المقطع الأول بداية الموضوع بكلمات واضحة [١]. ويذكر المقطع الثاني أجزاءه "
        "الثلاثة كاملة [٢]؟"
    ),
    "answer in Arabic, one sentence uncited": Shape(
        "يصف المقطع الأول بداية الموضوع بكلمات واضحة [١].\n\nوهذه جملة إضافية لا مصدر لها أبدا.",
        found={"unmarked"},
        text_lacks=("جملة إضافية",),
    ),
    "answer in Urdu": Shape(
        "پہلا حصہ موضوع کی ابتدا کو آسان الفاظ میں بیان کرتا ہے [۱]۔ دوسرا حصہ اس کے "
        "تین اجزاء بتاتا ہے [۲]۔"
    ),
    "answer in Urdu, one sentence uncited": Shape(
        "پہلا حصہ موضوع کی ابتدا کو آسان الفاظ میں بیان کرتا ہے [۱]۔\n\n"
        "یہ اضافی جملہ کسی ماخذ کے بغیر لکھا گیا ہے۔",
        found={"unmarked"},
        text_lacks=("اضافی جملہ",),
    ),
    "answer in Bengali": Shape(
        "প্রথম অংশটি সহজ ভাষায় বিষয়টির শুরু বর্ণনা করে [১]। দ্বিতীয় অংশটি এর তিনটি অংশের কথা বলে [২]।"
    ),
    "answer in Bengali, one sentence uncited": Shape(
        "প্রথম অংশটি সহজ ভাষায় বিষয়টির শুরু বর্ণনা করে [১]।\n\nএই অতিরিক্ত বাক্যটির কোনো উৎস একেবারেই নেই।",
        found={"unmarked"},
        text_lacks=("অতিরিক্ত",),
    ),
    "answer in French": Shape(
        "Le premier passage décrit le début du sujet en mots simples [1]. "
        "Le second en donne les trois parties [1, 2]."
    ),
    "answer in English": Shape(
        "The first passage describes the opening part in plain words [1]. "
        "The second gives the three parts [2]."
    ),
}


def settle(shape: Shape) -> tuple[set[str], RafiqAnswer | None]:
    """What verify does on the last attempt, then respond: no model is called."""
    units = parse(shape.draft)
    problems = code_problems(units, PASSAGES, shape.required)
    found: set[str] = {problem.kind for problem in problems}
    if problems:
        repaired = repair(units, problems, PASSAGES, shape.required)
        if repaired is None:
            return found, None
        units = repaired
    if shape.unsupported:
        flagged = [
            Problem("unsupported", "", unit=u, sentence=s)
            for index, (u, s, _) in enumerate(cited(units), start=1)
            if index in shape.unsupported
        ]
        found.add("unsupported")
        repaired = repair(units, flagged, PASSAGES, shape.required)
        if repaired is None:
            return found, None
        units = repaired
    finished = finish(units, PASSAGES, required_verse=shape.required, extractive=shape.extractive)
    return found, compose(finished, PASSAGES, "en", "A", explanations=shape.extractive)


def assert_guarantees(answer: RafiqAnswer) -> None:
    assert answer.sources, "an answer is never shown without sources"
    numbers = {source.n for source in answer.sources}
    texts = [block.text for block in answer.blocks if isinstance(block, TextBlock)]
    for text in texts:
        units = parse(text)
        for u, unit in enumerate(units):
            for s, sentence in enumerate(unit.sentences):
                if len(words(sentence)) >= MIN_CITED_WORDS and not is_lead_in(units, u, s):
                    assert set(unit.covering(s)) & numbers, f"uncovered: {sentence}"
    prose = " ".join(texts)
    book_text = " ".join(p.text for p in PASSAGES if not p.sacred)
    for passage in PASSAGES:
        for original in passage.sacred_texts():
            length = COPIED_RUN_ARABIC_SCRIPT if has_arabic(original) else COPIED_RUN_OTHER
            runs = {tuple(words(original)[i : i + length]) for i in range(len(words(original)))}
            prose_words = words(prose)
            shared = {
                tuple(prose_words[i : i + length]) for i in range(len(prose_words) - length + 1)
            } & runs
            book_words = words(book_text)
            from_books = {
                tuple(book_words[i : i + length]) for i in range(len(book_words) - length + 1)
            }
            assert not shared - from_books, f"sacred words of passage {passage.n} in the prose"
    sacred = [b for b in answer.blocks if isinstance(b, HadithBlock | QuranBlock)]
    assert len(sacred) <= MAX_BLOCKS
    by_ref = {p.key: p for p in PASSAGES}
    for block in sacred:
        if isinstance(block, HadithBlock):
            stored = by_ref[f"hadith:{block.id}"].hadith
            assert stored is not None
            assert block.arabic.encode() == stored.arabic.encode()
            assert (block.text or "").encode() == (stored.text or "").encode()
        else:
            stored_verse = by_ref[f"quran:{block.ref}"].verse
            assert stored_verse is not None
            assert block.arabic.encode() == stored_verse.arabic.encode()


def shown_blocks(answer: RafiqAnswer) -> list[tuple[str, str]]:
    return [
        ("hadith", str(b.id)) if isinstance(b, HadithBlock) else ("quran", b.ref)
        for b in answer.blocks
        if isinstance(b, HadithBlock | QuranBlock)
    ]


@pytest.mark.parametrize("name", list(SHAPES))
def test_shape(name: str) -> None:
    shape = SHAPES[name]
    found, answer = settle(shape)

    assert found == shape.found
    if shape.outcome == "referred":
        assert answer is None
        return
    assert answer is not None
    assert_guarantees(answer)
    assert shown_blocks(answer) == shape.blocks
    text = " ".join(b.text for b in answer.blocks if isinstance(b, TextBlock))
    for expected in shape.text_has:
        assert expected in text
    for unexpected in shape.text_lacks:
        assert unexpected not in text


def test_an_extractive_answer_shows_the_publishers_explanation() -> None:
    _, answer = settle(SHAPES["extractive answer trimmed to two sentences"])

    assert answer is not None
    block = next(b for b in answer.blocks if isinstance(b, HadithBlock))
    assert block.explanation == "The publisher's explanation of the narration."
