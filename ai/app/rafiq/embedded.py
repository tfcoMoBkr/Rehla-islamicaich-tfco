"""Verses and hadiths quoted inside a book's own text.

A book an answer cites may quote a verse or a hadith, and the answer may carry those words: the
copied-text check lets a run of an approved book through. Before the answer is shown, code looks
at each such quote it carries:
- a verse is matched to its QuranEnc entry (by the reference the book gives, or by its words), and
  the sentence that carries it is replaced by the verse's block;
- a hadith is matched to its HadeethEnc entry and the sentence is replaced by the hadith's block,
  which shows its grade. When no entry matches, the sentence stays and a fixed line after it says
  that the source does not state the hadith's grade.

A quote is found by how books write one: the words between quotation marks right after the
Prophet (ﷺ) is named with "said", or after "Allah says", or in Quran brackets, or followed by a
verse reference such as "[Ch. 40, Verse 60]".
"""

import re
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Literal

from app.rafiq.draft import Unit
from app.rafiq.repair import block_of
from app.retrieval.passages import Passage
from app.text import shares_run

# A sentence that shares this many words in a row with a quote carries it.
CARRIED_RUN = 5
# Quotes looked up per answer: each lookup may be a call to the approved sources.
MAX_LOOKUPS = 2
NOTE = ("note", "gradeNotStated")

QUOTE = re.compile(r"[«\"“{(﴿](?P<text>[^«»\"“”{}()﴿﴾]{12,700})[»\"”})﴾]")
PROPHET = re.compile(
    r"النبي|نبينا|رسول\s*الله|ﷺ|صلى\s*الله\s*عليه\s*وسلم"
    r"|\bthe\s+Prophet\b|\bMessenger\s+of\s+Allah\b|\bAllah['’]s\s+Messenger\b|\(pbuh\)",
    re.IGNORECASE,
)
SAYS = re.compile(r"قال|يقول|قوله|\b(?:said|says|replied|answered)\b", re.IGNORECASE)
# Someone else speaking after the Prophet (ﷺ) is named: the quote is theirs.
COMPANION = re.compile(r"رضي\s*الله\s*عن|may\s+Allah\s+be\s+pleased\s+with", re.IGNORECASE)
# "Allah Almighty says"; a bracket between them ("may Allah be pleased with him) said") is a
# blessing on someone else who speaks.
ALLAH_SAYS = re.compile(
    r"(?:قال|يقول|قوله)\s*(?:الله|تعالى|سبحانه)|\bAllah\b[^.\"“{()]{0,40}\b(?:says|said)\b",
    re.IGNORECASE,
)
VERSE_REFERENCE = re.compile(
    r"^\s*(?:\[\s*Ch\.?\s*(?P<a1>\d{1,3})\s*,\s*Verse\s*(?P<b1>\d{1,3})\s*\]"
    r"|[\[(][^\[\]()\d]{0,30}(?P<a2>\d{1,3})\s*:\s*(?P<b2>\d{1,3})\s*[\])])",
    re.IGNORECASE,
)
WINDOW = 120
# A hadith's attribution lies within this many characters before its quote...
ATTRIBUTION = 80
# ...and its last word ("said", "ﷺ") at most this many before the quotation mark.
VERB_GAP = 25


@dataclass(frozen=True)
class Quote:
    kind: Literal["quran", "hadith"]
    text: str
    # The verse reference the book gives with the quote, if any.
    ref: tuple[int, int] | None = None


def quotes_in(text: str) -> list[Quote]:
    found: list[Quote] = []
    for match in QUOTE.finditer(text):
        before = text[max(0, match.start() - WINDOW) : match.start()]
        reference = VERSE_REFERENCE.match(text[match.end() : match.end() + 40])
        ref = None
        if reference:
            groups = reference.groupdict()
            surah, ayah = groups["a1"] or groups["a2"], groups["b1"] or groups["b2"]
            ref = (int(surah), int(ayah))
        quoted = match.group("text").strip()
        if match.group(0).startswith("﴿") or ref or _ends_near(ALLAH_SAYS, before):
            found.append(Quote("quran", quoted, ref))
            continue
        # "The Prophet (ﷺ) said: “…”" and «قال رسول الله ﷺ: «…»»: the name and the verb just
        # before the quote, with no one else's blessing ("may Allah be pleased with him") after
        # the name, since then that person speaks.
        near = before[-ATTRIBUTION:]
        prophet = list(PROPHET.finditer(near))
        if (
            prophet
            and SAYS.search(near)
            and (_ends_near(SAYS, before) or _ends_near(PROPHET, before))
            and not COMPANION.search(near[prophet[-1].end() :])
        ):
            found.append(Quote("hadith", quoted))
    return found


def _ends_near(pattern: re.Pattern[str], before: str) -> bool:
    """Whether the pattern's last match ends within VERB_GAP characters of the quote."""
    matches = list(pattern.finditer(before))
    return bool(matches) and len(before) - matches[-1].end() <= VERB_GAP


def carried(units: list[Unit], passages: list[Passage]) -> dict[Quote, list[tuple[int, int]]]:
    """Each quote of a book passage that the answer's own sentences carry, with where."""
    quotes = [quote for p in passages if not p.sacred for quote in quotes_in(p.text)]
    found: dict[Quote, list[tuple[int, int]]] = {}
    for u, unit in enumerate(units):
        if unit.kind == "block":
            continue
        for s, sentence in enumerate(unit.sentences):
            for quote in quotes:
                if shares_run(sentence, quote.text, CARRIED_RUN):
                    found.setdefault(quote, []).append((u, s))
    return found


Matcher = Callable[[Quote], Awaitable[Passage | None]]


async def place_quotes(
    units: list[Unit], passages: list[Passage], match: Matcher
) -> tuple[list[Unit], list[Passage]]:
    """The answer with each carried quote shown from its own source (see the module's text), and
    the passages with any verse or hadith found for it added."""
    passages = list(passages)
    removed: set[tuple[int, int]] = set()
    after: dict[int, list[tuple[str, str]]] = {}
    shown = {unit.block for unit in units if unit.kind == "block"}
    for quote, places in list(carried(units, passages).items())[:MAX_LOOKUPS]:
        passage = await match(quote)
        last = max(u for u, _ in places)
        if passage is None:
            if quote.kind == "hadith":
                after.setdefault(last, []).append(NOTE)
            continue
        known = next((p for p in passages if p.key == passage.key), None)
        if known is None:
            known = passage.model_copy(update={"n": max((p.n for p in passages), default=0) + 1})
            passages.append(known)
        removed.update(places)
        block = block_of(known)
        if block and block not in shown:
            shown.add(block)
            after.setdefault(last, []).append(block)
    result: list[Unit] = []
    for u, unit in enumerate(units):
        sentences = [s for i, s in enumerate(unit.sentences) if (u, i) not in removed]
        if unit.kind == "block" or sentences:
            result.append(Unit(unit.kind, sentences, unit.prefix, unit.block, unit.role))
        result.extend(Unit("block", block=block) for block in after.get(u, []))
    return result, passages
