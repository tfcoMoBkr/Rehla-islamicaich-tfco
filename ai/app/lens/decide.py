"""DECIDE: the Lens decision table as code (docs/RELIABILITY.md, "Lens"). The vision model only
reports what it sees; whether Lens answers, declines or answers within a boundary is decided here,
from that report and from the approved-source lookup, never by a model.

Precedence when rows collide: 10 (unsafe), 9 (personal document), 7 (a person), 8 (unclear),
11 (scripture that matches nothing), then the rest.
"""

from dataclasses import dataclass
from typing import Literal

from app.lens.schemas import Card, Seen
from app.text import has_arabic, words

# Below this the photo is not read with enough certainty to say anything about it.
MIN_CONFIDENCE = 0.6
# Short Arabic text (a phrase on a wall) is looked up in case it is a verse or a hadith. A word or
# two is not: a single word appears in many verses, and would "match" one it was never taken from.
PHRASE_WORDS = (3, 30)

Explain = Literal["subject", "term"]


@dataclass(frozen=True)
class Decision:
    row: int
    card: Card | None = None
    # What EXPLAIN asks Rafiq about, if anything: the subject, or a religious term in the text.
    explain: Explain | None = None
    term: str | None = None
    # Rows 4 and 5: the matched verse or hadith is shown as its published block.
    block: bool = False
    # Row 14: no ruling, the specialist card.
    specialist: bool = False


def _declined(seen: Seen) -> Decision | None:
    """Rows 10, 9, 7 and 8, in that order: nothing is described, read or looked up."""
    if seen.kind == "unsafe":
        return Decision(10, card="unsafe")
    if seen.category == "personalDocument":
        return Decision(9, card="privacy")
    if seen.kind == "person":
        return Decision(7, card="person")
    if seen.kind == "unclear" or seen.quality != "good" or seen.confidence < MIN_CONFIDENCE:
        return Decision(8, card="unclear")
    return None


def lookup_text(seen: Seen) -> str | None:
    """The text to look up in the approved sources: anything that looks like scripture, and short
    Arabic phrases (rows 4, 5 and 11). Never for a declined photo."""
    if _declined(seen) or not seen.visible_text:
        return None
    text = seen.visible_text.text.strip()
    if not text:
        return None
    shortest, longest = PHRASE_WORDS
    phrase = has_arabic(text) and shortest <= len(words(text)) <= longest
    if seen.looks_like_scripture or phrase:
        return text
    return None


def _term_in_text(seen: Seen) -> str | None:
    """The first religious term the model named that really is in the text read. A term the text
    does not hold is never explained: the model cannot add a religious connection of its own."""
    if not seen.visible_text:
        return None
    read = " ".join(words(seen.visible_text.text))
    for term in seen.religious_terms:
        found = " ".join(words(term))
        if found and found in read:
            return term.strip()
    return None


def decide(seen: Seen, matched: bool) -> Decision:
    """`matched`: the lookup found the text read in the approved sources (a verse or a hadith)."""
    declined = _declined(seen)
    if declined:
        return declined
    if seen.looks_like_scripture and not matched:
        return Decision(11, card="unmatched")
    if matched:
        return Decision(4 if seen.looks_like_scripture else 5, block=True)
    if seen.category == "rulingRequest":
        return Decision(14, specialist=True)
    if seen.category == "post":
        return Decision(15)
    if seen.category == "food":
        return Decision(13)
    if seen.category == "otherReligion":
        return Decision(16)
    if seen.visible_text and (seen.kind in ("text", "document") or seen.category == "sign"):
        term = _term_in_text(seen)
        return Decision(3, explain="term" if term else None, term=term)
    if seen.category in ("worship", "mosque") and seen.subject.strip():
        if seen.people_present:
            return Decision(6, explain="subject")
        return Decision(2 if seen.kind == "place" else 1, explain="subject")
    return Decision(12, card="nothing")


def shown(seen: Seen, decision: Decision) -> Seen | None:
    """What of the reading the learner sees. A declined photo is not described; a personal document
    is not read out. Text that looks like scripture is neither shown as the model read it nor
    machine-translated: a verse or hadith appears only as its published block."""
    if decision.row in (7, 8, 10):
        return Seen(kind=seen.kind, confidence=seen.confidence, quality=seen.quality)
    if decision.row == 9:
        return Seen(kind=seen.kind, confidence=seen.confidence, category=seen.category)
    if decision.row in (4, 5, 11) or seen.looks_like_scripture:
        return seen.model_copy(
            update={"visible_text": None, "plain_translation": None, "religious_terms": []}
        )
    return seen.model_copy(update={"religious_terms": []})
