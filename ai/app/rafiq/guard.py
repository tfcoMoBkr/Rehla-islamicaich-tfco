"""The ruling guard in code, for a question about the asker's own situation (a personal case) or a
request for a ruling (level D).

Whatever the model wrote, such a reply holds only:
- at most one plain sentence saying what the topic is, kept only if it applies nothing to the
  asker: no ruling word (valid, forbidden, must, halal, «يجوز», «باطل»…) and no "you" or «ك»;
- at most one verbatim source block, as background: a verse or hadith it showed, else the
  most relevant book passage it cited;
- the fixed line that this is general information, not a ruling on the asker's situation;
then the specialist card, which says that the answer depends on details a specialist must hear.
The model check's ruling guard (prompts/rules/verify-general.md) still runs; this holds whatever
it decides.
"""

import re

from app.rafiq.draft import Unit, markers
from app.retrieval.passages import Passage
from app.text import words

RULING = re.compile(
    r"\b(?:valid|invalid|void|allowed|permitted|permissible|impermissible|forbidden|prohibited|"
    r"obligatory|required|must|mustn't|have\s+to|has\s+to|should|shouldn't|halal|haram|makruh|"
    r"sinful|sin|lawful|unlawful|accepted|acceptable|unacceptable)\b"
    r"|يجوز|جائز|حرام|محرم|محرّم|حلال|واجب|يجب|فرض|باطل|يبطل|تبطل|يصح|صحيح|مكروه|مقبول|تقبل|"
    r"يقبل|ينبغي|إثم|آثم|عليك",
    re.IGNORECASE,
)
SECOND_PERSON = re.compile(r"\b(?:you|your|yours|yourself)\b|أنت|أنتِ|عليك|لكِ?\b", re.IGNORECASE)
# Arabic words that end in «ك» without being "your".
NOT_YOURS = {"ذلك", "كذلك", "تلك", "هنالك", "هناك", "ملك", "شك", "ترك", "مالك", "مبارك", "سلوك"}
NOTE = ("note", "notARuling")


def applies_to_the_asker(sentence: str) -> bool:
    """Whether a sentence rules, or speaks to the asker about their own case."""
    if RULING.search(sentence) or SECOND_PERSON.search(sentence):
        return True
    return any(
        word.endswith("ك") and len(word) > 3 and word not in NOT_YOURS for word in words(sentence)
    )


def guarded(units: list[Unit], passages: list[Passage]) -> list[Unit]:
    """A ruling or personal-case reply cut down to what the module's text allows."""
    sentence = next(
        (
            text
            for unit in units
            if unit.kind != "block" and unit.role == "answer"
            for text in unit.sentences[:1]
        ),
        None,
    )
    kept = (
        [Unit("paragraph", [sentence])] if sentence and not applies_to_the_asker(sentence) else []
    )
    block = next((unit.block for unit in units if unit.kind == "block" and unit.block), None)
    if block is None:
        cited = [n for unit in units for text in unit.sentences for n in markers(text)]
        books = {p.n: p for p in passages if p.type == "book"}
        number = next((n for n in cited if n in books), None)
        block = ("book", str(number)) if number is not None else None
    if block is None:
        return kept
    return [*kept, Unit("block", block=block), Unit("block", block=NOTE)]


def without_rulings(lines: dict[str, str]) -> dict[str, str]:
    """The everyday lines of such a reply, without any that uses ruling words."""
    return {field: line for field, line in lines.items() if not RULING.search(line)}
