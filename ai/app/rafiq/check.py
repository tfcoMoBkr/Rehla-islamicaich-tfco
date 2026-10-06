"""The checks verify runs in code, before any model is asked, on the parsed draft (draft.py).

Every problem has a category, so logs can count them without carrying any text, and points at the
sentence or block it concerns, so repair.py can act on it.

- unmarked: a sentence of MIN_CITED_WORDS or more words that no marker covers. A sentence is
  covered by its own markers or by those that close its paragraph or list item. A short lead-in
  ending with a colon before a block, or a list introduction, needs none.
- unknownMarker / unknownBlock: a marker or placeholder that points to no retrieved passage.
- copiedSacred: a sentence shares a run of words with a verse or hadith (its Arabic or its
  published translation) that no retrieved book passage also contains.
- verseBrackets: Quran brackets in a sentence: verses are shown only as blocks.
- missingVerse: a misquoted verse is not shown.
- unsupported: the model check found a sentence (or explanation paragraph) its passages do not
  support.
- tarjih: wording that picks a winner between scholarly views ("the correct view", «الراجح»,
  "closest to the truth") or blesses the difference ("disagreement is a mercy"). Only a verbatim
  block may say that; Rafiq's own words never do.
- consensus: a claim that scholars agree, or that they differ, in a sentence none of whose cited
  passages speaks of agreement (or of difference).
"""

import re
from collections import Counter
from dataclasses import dataclass
from typing import Literal

from app.languages import Language, spec, written_in
from app.rafiq.draft import Unit, markers, strip_markers
from app.retrieval.passages import Passage
from app.text import has_arabic, words

ProblemKind = Literal[
    "unmarked",
    "unknownMarker",
    "unknownBlock",
    "copiedSacred",
    "verseBrackets",
    "missingVerse",
    "unsupported",
    "wrongLanguage",
    "tarjih",
    "consensus",
    "offTopic",
    "unexplained",
    "attribution",
]

MIN_CITED_WORDS = 4
# "The verse is:" introduces a block; "These are the steps:" introduces a list.
LEAD_IN_WORDS = 8
LIST_INTRO_WORDS = 12
# Shared word runs this long (or longer) mean sacred text was copied rather than shown.
COPIED_RUN_ARABIC_SCRIPT = 7
COPIED_RUN_OTHER = 9


# Wording that settles a disputed matter, and wording that claims agreement. They describe how a
# sentence argues, not any topic.
TARJIH = re.compile(
    r"الراجح|القول\s+الراجح|الصحيح\s+من\s+(?:القولين|الأقوال)|الأصح|أصح\s+الأقوال"
    r"|(?:الرأي|القول)\s+(?:الصحيح|الأقوى|المختار)"
    r"|\bthe\s+(?:correct|strongest|stronger|preferred|soundest|most\s+correct|right)\s+"
    r"(?:view|opinion|position|saying)\b"
    # Choosing for the reader, or blessing the difference itself.
    r"|closest\s+to\s+the\s+truth|nearest\s+to\s+the\s+truth|disagreement\s+is\s+a\s+mercy"
    r"|differences?\s+(?:of\s+opinion\s+)?(?:is|are)\s+a\s+mercy"
    r"|أقرب\s+إلى\s+(?:الصواب|الحق)|الخلاف\s+رحمة|اختلاف\s+\S+\s+رحمة|الاختلاف\s+رحمة",
    flags=re.IGNORECASE,
)
# A claim about what scholars (or Muslims) as a whole hold: that they agree, or that they differ.
CONSENSUS = re.compile(
    r"أجمع\w*|بالإجماع|إجماع\w*|اتفق\s+(?:العلماء|المسلمون|الفقهاء)|باتفاق\s+(?:العلماء|الفقهاء)"
    r"|(?:العلماء|المسلمون|الفقهاء)\s+(?:كلهم\s+|جميعًا\s+|جميعا\s+)?(?:يتفقون|متفقون|مجمعون)"
    r"|\b(?:all\s+)?(?:muslims|scholars)\s+(?:all\s+)?(?:agree|accept|hold|are\s+agreed)\b"
    r"|\bconsensus\b|\bunanimous\w*|\bagreed\s+upon\s+by\s+(?:all|the)\s+scholars\b",
    flags=re.IGNORECASE,
)
DIFFERENCE = re.compile(
    r"اختلف\s+(?:العلماء|الفقهاء)|اختلاف\s+(?:العلماء|الفقهاء)|خلاف\s+بين\s+(?:العلماء|الفقهاء)"
    r"|(?:العلماء|الفقهاء)\s+(?:يختلفون|مختلفون)"
    r"|\b(?:scholars|jurists)\s+(?:may\s+|sometimes\s+|often\s+)?(?:differ|disagree|have\s+"
    r"different\s+(?:views|opinions))\b",
    flags=re.IGNORECASE,
)
AGREEMENT_IN_SOURCE = re.compile(r"أجمع|إجماع|اتفق|اتفاق|consensus|agree|unanim", re.IGNORECASE)
# Words attributed to the Prophet ﷺ or to the Quran: only where the answer shows the matched
# verse or hadith block itself.
ATTRIBUTION = re.compile(
    r"\b(?:the\s+)?(?:prophet|messenger)\b[^.]{0,40}\b(?:said|says|stated|states)\b"
    r"|\b(?:a|is\s+a|is\s+the)\s+(?:saying|hadith)\s+of\s+the\s+(?:prophet|messenger)"
    r"|\bis\s+a\s+hadith\b|\b(?:allah|the\s+quran)\s+says\b|\bis\s+a\s+verse\b"
    r"|قال\s+(?:النبي|رسول\s+الله|الرسول)|حديث\s+(?:نبوي|عن\s+النبي)|قال\s+(?:الله|تعالى)"
    r"|يقول\s+(?:الله|تعالى)|من\s+كلام\s+النبي",
    re.IGNORECASE,
)
DIFFERENCE_IN_SOURCE = re.compile(r"اختلف|اختلاف|خلاف|differ|disagree", re.IGNORECASE)


@dataclass(frozen=True)
class Problem:
    kind: ProblemKind
    text: str
    unit: int | None = None
    sentence: int | None = None
    passage: int | None = None


def counts(problems: list[Problem]) -> dict[str, int]:
    return dict(Counter(problem.kind for problem in problems))


def find_passage(passages: list[Passage], kind: str, reference: str) -> Passage | None:
    for passage in passages:
        if kind == "quran" and passage.verse and passage.verse.ref == reference:
            return passage
        if kind == "hadith" and passage.hadith and str(passage.hadith.id) == reference:
            return passage
    return None


def is_lead_in(units: list[Unit], unit: int, sentence: int) -> bool:
    """The last sentence of a paragraph, ending with a colon, that introduces a block or a list."""
    current = units[unit]
    text = current.sentences[sentence]
    if sentence != len(current.sentences) - 1 or not text.rstrip().endswith((":", "：")):
        return False
    following = units[unit + 1] if unit + 1 < len(units) else None
    length = len(words(strip_markers(text)))
    if following and following.kind == "block":
        return length <= LEAD_IN_WORDS
    if following and following.kind == "item":
        return length <= LIST_INTRO_WORDS
    return False


def cited(units: list[Unit]) -> list[tuple[int, int, list[int]]]:
    """(unit, sentence, passage numbers) for every sentence a marker covers."""
    found = []
    for u, unit in enumerate(units):
        for s in range(len(unit.sentences)):
            numbers = unit.covering(s)
            if numbers:
                found.append((u, s, numbers))
    return found


def _runs(text: str, length: int) -> set[tuple[str, ...]]:
    sequence = words(text)
    return {tuple(sequence[start : start + length]) for start in range(len(sequence) - length + 1)}


def _run_length(text: str) -> int:
    return COPIED_RUN_ARABIC_SCRIPT if has_arabic(text) else COPIED_RUN_OTHER


def code_problems(
    units: list[Unit],
    passages: list[Passage],
    required_verse: str | None = None,
    language: Language | None = None,
) -> list[Problem]:
    """What is wrong with a parsed draft, by code alone. `required_verse` must be shown, and
    the prose must be written in `language`'s script."""
    problems: list[Problem] = []
    numbers = {passage.n for passage in passages}
    blocks = [unit.block for unit in units if unit.kind == "block"]
    if required_verse and ("quran", required_verse) not in blocks:
        placeholder = f"{{{{quran:{required_verse}}}}}"
        problems.append(
            Problem(
                "missingVerse",
                f"The asker misquoted a verse: show the real verse with {placeholder} "
                "and say gently that its wording is different.",
            )
        )
    # A book that quotes a verse or hadith may be summarised in its own words: a run the answer
    # shares with such a passage comes from that approved text, not from memory.
    book_runs = book_runs_of(passages)
    for u, unit in enumerate(units):
        if unit.kind == "block" and unit.block:
            kind, reference = unit.block
            if find_passage(passages, kind, reference) is None:
                problems.append(
                    Problem(
                        "unknownBlock",
                        f"Placeholder {{{{{kind}:{reference}}}}} is not one of the passages.",
                        unit=u,
                    )
                )
            continue
        for s, sentence in enumerate(unit.sentences):
            problems.extend(
                _sentence_problems(units, u, s, sentence, passages, numbers, book_runs, language)
            )
            if not blocks and ATTRIBUTION.search(sentence):
                problems.append(
                    Problem(
                        "attribution",
                        "This sentence attributes words to the Prophet or the Quran, but no "
                        f"matched verse or hadith is shown: «{sentence[:120]}»",
                        unit=u,
                        sentence=s,
                    )
                )
    return problems


def _sentence_problems(
    units: list[Unit],
    u: int,
    s: int,
    sentence: str,
    passages: list[Passage],
    numbers: set[int],
    book_runs: dict[int, set[tuple[str, ...]]],
    language: Language | None = None,
) -> list[Problem]:
    found: list[Problem] = []
    quoted = sentence[:120]
    if language and not written_in(strip_markers(sentence), language):
        found.append(
            Problem(
                "wrongLanguage",
                f"This sentence is not in {spec(language).name}: «{quoted}»",
                unit=u,
                sentence=s,
            )
        )
    unknown = sorted(set(markers(sentence)) - numbers)
    if unknown:
        found.append(
            Problem(
                "unknownMarker", f"Marker [{unknown[0]}] points to no passage.", unit=u, sentence=s
            )
        )
    length = len(words(strip_markers(sentence)))
    if length >= MIN_CITED_WORDS and not units[u].covering(s) and not is_lead_in(units, u, s):
        found.append(
            Problem(
                "unmarked", f"This sentence has no source marker: «{quoted}»", unit=u, sentence=s
            )
        )
    if "﴿" in sentence or "﴾" in sentence:
        found.append(
            Problem(
                "verseBrackets",
                "Verse brackets appear in the text; show a verse only with its placeholder.",
                unit=u,
                sentence=s,
            )
        )
    if TARJIH.search(sentence):
        found.append(
            Problem(
                "tarjih",
                "This sentence picks one view over another; say only what the passages "
                f"state: «{quoted}»",
                unit=u,
                sentence=s,
            )
        )
    cited_texts = [p.text for p in passages if p.n in units[u].covering(s)]
    for claim, in_source, what in (
        (CONSENSUS, AGREEMENT_IN_SOURCE, "an agreement"),
        (DIFFERENCE, DIFFERENCE_IN_SOURCE, "a difference among scholars"),
    ):
        if claim.search(sentence) and not any(in_source.search(text) for text in cited_texts):
            found.append(
                Problem(
                    "consensus",
                    f"This sentence claims {what} its passages do not state: «{quoted}»",
                    unit=u,
                    sentence=s,
                )
            )
    copied = copied_from(sentence, passages, book_runs)
    if copied is not None:
        found.append(
            Problem(
                "copiedSacred",
                f"Words of passage [{copied}] are written in the text; "
                "show it with its placeholder instead.",
                unit=u,
                sentence=s,
                passage=copied,
            )
        )
    return found


def book_runs_of(passages: list[Passage]) -> dict[int, set[tuple[str, ...]]]:
    """Word runs of the book and term passages: a run found there is the book's, not memory's."""
    book_text = " ".join(p.text for p in passages if not p.sacred)
    return {n: _runs(book_text, n) for n in (COPIED_RUN_ARABIC_SCRIPT, COPIED_RUN_OTHER)}


def copied_from(
    text: str, passages: list[Passage], book_runs: dict[int, set[tuple[str, ...]]]
) -> int | None:
    """The number of the verse or hadith whose words the text copies, if any."""
    for passage in passages:
        for original in passage.sacred_texts():
            length = _run_length(original)
            if (_runs(text, length) & _runs(original, length)) - book_runs[length]:
                return passage.n
    return None
