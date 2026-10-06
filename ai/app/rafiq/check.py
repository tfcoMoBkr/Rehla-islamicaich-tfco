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
from app.rafiq.amounts import about, amounts, asks_amount, same_form, stated_by
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
    "worshipWords",
    "amount",
    "noAmount",
    "quoted",
]

MIN_CITED_WORDS = 4
# "The verse is:" introduces a block; "These are the steps:" introduces a list.
LEAD_IN_WORDS = 8
LIST_INTRO_WORDS = 12
# Shared word runs this long (or longer) mean sacred text was copied rather than shown.
COPIED_RUN_ARABIC_SCRIPT = 7
COPIED_RUN_OTHER = 9
# Inside quotation marks, this many words of a verse or hadith are already its text.
QUOTED_RUN = 3
# A quoted term this short may come from a cited passage (a glossary or book term).
TERM_WORDS = 2
QUOTED_SPAN = re.compile(r"«([^»]+)»|\"([^\"]+)\"|“([^”]+)”")


# Wording that settles a disputed matter, and wording that claims agreement. They describe how a
# sentence argues, not any topic.
TARJIH = re.compile(
    r"الراجح|القول\s+الراجح|الصحيح\s+من\s+(?:القولين|الأقوال)|الأصح|أصح\s+(?:الأقوال|القولين)"
    r"|الأرجح|أرجح\s+(?:الأقوال|القولين)|أقوى\s+الأقوال|\bpreponderant\b"
    r"|(?:الرأي|القول)\s+(?:الصحيح|الأقوى|المختار)"
    r"|\bthe\s+(?:correct|strongest|stronger|preferred|soundest|most\s+correct|right)\s+"
    r"(?:view|opinion|position|saying)\b"
    # Choosing for the reader, or blessing the difference itself.
    r"|closest\s+to\s+the\s+truth|nearest\s+to\s+the\s+truth|disagreement\s+is\s+a\s+mercy"
    r"|differences?\s+(?:of\s+opinion\s+)?(?:is|are)\s+a\s+mercy"
    r"|أقرب\s+إلى\s+(?:الصواب|الحق)|الخلاف\s+رحمة|اختلاف\s+(?:\S+\s+)?رحمة|الاختلاف\s+رحمة",
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
# Words of worship (a remembrance, a supplication, the words said in prayer) typed into the prose,
# in any language Rafiq writes, quoted or not, translated or transliterated. Patterns to detect
# such words; they are never shown. The words themselves appear only in a published block.
WORSHIP_WORDS = re.compile(
    r"سبحانك|سبحان\s+(?:ربي|الله|ربك)|اللهم|ربنا|ربي?\s*اغفر|أستغفر\s+الله|سمع\s+الله\s+لمن"
    r"|التحيات\s+لله|الله\s+أكبر|بسم\s+الله|أعوذ\s+بالله|لا\s+حول\s+ولا\s+قوة|حسبنا\s+الله"
    r"|إنا\s+لله\s+وإنا|يرحمك\s+الله|يهديكم\s+الله|الحمد\s+لله\s+رب\s+العالمين"
    r"|اللہ\s+اکبر|بسم\s+اللہ|اے\s+اللہ|سبحان|হে\s+আল্লাহ|আল্লাহু\s+আকবার|সুবহানা"
    r"|\b(?:subh?ana(?:ka)?|subhan|allahumm?a|rabbana|allahu\s+akbar|sami['’]?a\s*-?\s*allah"
    r"|astaghfirullah|bismillah|a['’]?[uo]o?dhu\s+billah|la\s+hawla|alhamdu\s*lillahi?\s+rabb"
    r"|at-?tahiyyat|hasbuna\s*allah|yarhamuk)\b"
    r"|\bglory\s+be\s+to\s+(?:you|allah|my\s+lord)|\bo\s+allah\b|\bour\s+lord\b"
    r"|\ballah\s+is\s+(?:the\s+)?(?:most\s+)?great(?:est)?\b|\ballah\s+hears\b"
    r"|\bin\s+the\s+name\s+of\s+allah\b|\bi\s+seek\s+refuge\b|\ball\s+greetings"
    r"|\bmay\s+allah\s+have\s+mercy\s+on\s+you\b|السلام\s+عليكم\s+ورحمة\s+الله"
    r"|\bpeace\s+(?:be\s+upon\s+you\s+)?and\s+(?:the\s+)?mercy\s+of\s+allah\b"
    r"|\bas-?salamu?\s+[ʿ'‘]?alaykum\s+wa\s*rahmatu"
    r"|\bgloire\s+(?:à\s+toi|à\s+allah)|\bô\s+allah\b|\bnotre\s+seigneur\b"
    r"|\ballah\s+est\s+(?:le\s+)?plus\s+grand\b|\bau\s+nom\s+d['’]allah\b",
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
    asked: str = "",
    counted: list[str] | None = None,
) -> list[Problem]:
    """What is wrong with a parsed draft, by code alone. `required_verse` must be shown, and
    the prose must be written in `language`'s script. Words of worship the learner wrote in
    `asked` may be named back to them; any others in the prose are not Rafiq's to write."""
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
            if worship_words(sentence, asked):
                problems.append(
                    Problem(
                        "worshipWords",
                        "This sentence writes words of a remembrance or a supplication. Name the "
                        "step instead; its words are shown only in a published block: "
                        f"«{sentence[:120]}»",
                        unit=u,
                        sentence=s,
                    )
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
    shown = [
        text
        for block in blocks
        if block is not None and (passage := find_passage(passages, *block)) is not None
        for text in passage.sacred_texts()
    ]
    terms = [passage.text for passage in passages if not passage.sacred]
    for u, unit in enumerate(units):
        if unit.kind == "block":
            continue
        for s, sentence in enumerate(unit.sentences):
            span = unshown_quote(sentence, [*shown, asked], terms)
            if span is not None and quoted_from(sentence, passages) is None:
                problems.append(
                    Problem(
                        "quoted",
                        "Words in quotation marks must come from a verse or hadith shown with "
                        f"the answer; say it in your own words instead: «{span[:80]}»",
                        unit=u,
                        sentence=s,
                    )
                )
    if asks_amount(asked) and language is not None:
        problems.extend(_amount_problems(units, passages, language, counted or [], asked))
    return problems


def _amount_problems(
    units: list[Unit],
    passages: list[Passage],
    language: Language,
    counted: list[str],
    asked: str = "",
) -> list[Problem]:
    """A "how many" reply: each amount must be stated by a passage its sentence cites; with none
    stated, the reply has not answered what was asked."""
    found: list[Problem] = []
    stated = 0
    # The form is read from the whole reply: "these rak'ahs" refers back to an earlier sentence.
    form = same_form(" ".join(s for unit in units for s in unit.sentences), asked)
    for u, unit in enumerate(units):
        if unit.kind == "block":
            continue
        for s, sentence in enumerate(unit.sentences):
            plain = strip_markers(sentence)
            if not amounts(plain) or not about(plain, counted):
                continue
            cited = [p for p in passages if p.n in unit.covering(s)]
            if form and any(stated_by(plain, p, language) for p in cited):
                stated += 1
                continue
            found.append(
                Problem(
                    "amount",
                    "No passage this sentence cites states this amount, in the reply's "
                    f"language: «{sentence[:120]}»",
                    unit=u,
                    sentence=s,
                )
            )
    if not stated:
        found.append(
            Problem("noAmount", "The question asks how many or how much; no passage states it.")
        )
    return found


# The verb that introduced words of worship, left dangling once the words are cut.
SAYING = re.compile(
    r"\s*(?:مثل\s+|ك)?(?:و?(?:تقول|يقول|تقولين|قل|بقول|قول|قائلًا|قائلا)(?:\s+في\s+\S+)?"
    r"|\b(?:and\s+)?(?:say|saying|by\s+saying)\b(?:\s+in\s+\S+\s+\S+)?)\s*$",
    re.IGNORECASE,
)
# A sentence cut shorter than this no longer names a step.
STEP_WORDS = 2


def without_worship_words(sentence: str, asked: str = "") -> str | None:
    """The sentence with the words of worship it typed cut out (from the colon or quotation mark
    that introduces them, or from the words themselves), so it still names the step; None when
    nothing is left of it. Only removes: no word is added."""
    tags = "".join(f"[{n}]" for n in markers(sentence))
    body = strip_markers(sentence)
    while found := worship_words(body, asked):
        at = body.find(found)
        opener = max(body.rfind(mark, 0, at) for mark in (":", '"', "«", "“"))
        body = body[: opener if opener >= 0 else at]
    body = SAYING.sub("", body.rstrip(' ،,.:"«“')).rstrip(" ،,")
    if len(words(body)) < STEP_WORDS:
        return None
    return f"{body} {tags}." if tags else f"{body}."


def worship_words(sentence: str, asked: str = "") -> str | None:
    """Words of worship typed into a sentence that the learner did not write themselves."""
    said = " ".join(words(asked))
    for found in WORSHIP_WORDS.finditer(sentence):
        if not said or " ".join(words(found.group(0))) not in said:
            return found.group(0)
    return None


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
    if copied is None:
        copied = quoted_from(sentence, passages)
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


def unshown_quote(sentence: str, allowed: list[str], terms: list[str]) -> str | None:
    """Words the sentence puts in quotation marks that come from none of the `allowed` texts (the
    blocks shown with the answer, the learner's own question). A term of one or two words may also
    come from a cited passage."""
    allowed_words = [" ".join(words(text)) for text in allowed]
    term_words = [" ".join(words(text)) for text in terms]
    for span in QUOTED_SPAN.finditer(sentence):
        quoted = next(group for group in span.groups() if group)
        said = " ".join(words(quoted))
        if not said or any(said in text for text in allowed_words):
            continue
        if len(said.split()) <= TERM_WORDS and any(said in text for text in term_words):
            continue
        return quoted
    return None


def without_quote(sentence: str, quoted: str) -> str | None:
    """The sentence without the quoted words and their quotation marks; None when too little of it
    is left to stand."""
    tags = "".join(f"[{n}]" for n in markers(sentence))
    body = strip_markers(sentence)
    for opening, closing in (("«", "»"), ('"', '"'), ("“", "”")):
        body = body.replace(f"{opening}{quoted}{closing}", " ")
    body = re.sub(r"\s{2,}", " ", body).strip(" :،,.")
    if len(words(body)) < STEP_WORDS + 1:
        return None
    return f"{body} {tags}." if tags else f"{body}."


def quoted_from(text: str, passages: list[Passage]) -> int | None:
    """The number of the verse or hadith whose words the text puts in quotation marks, even a few
    of them: quoted, they are presented as the text itself, which only its block may show."""
    for span in QUOTED_SPAN.finditer(text):
        quoted = next(group for group in span.groups() if group)
        for passage in passages:
            for original in passage.sacred_texts():
                if _runs(quoted, QUOTED_RUN) & _runs(original, QUOTED_RUN):
                    return passage.n
    return None


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
