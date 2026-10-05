"""The warm lines around an answer: the opening, the follow-up, a clarifying question, a reply to
small talk. They make a reply feel like a conversation, but they never carry a religious statement.

Code keeps them short (whole sentences only, within a length limit) and drops any line that holds
a source marker, a verse or hadith placeholder, Quran brackets or words copied from a verse or
hadith, that is not written in the reply's language, or that an earlier reply already said. The
model check (prompts/verify.md) then drops any line that makes a religious statement. A dropped
line is simply not shown; it never causes a referral.
"""

from app.languages import Language, written_in
from app.rafiq.check import book_runs_of, copied_from
from app.rafiq.draft import MARKER, PLACEHOLDER, canonical_markers, split_sentences
from app.rafiq.name import without_name
from app.retrieval.passages import Passage
from app.text import words

# (whole sentences kept, longest text kept) per line.
LIMITS = {"opening": (2, 240), "followUp": (1, 180), "clarification": (1, 160)}
WARM_FIELDS = tuple(LIMITS)


def _short(field: str, text: str) -> str | None:
    """The most whole sentences, up to the field's count, that fit within its length."""
    count, longest = LIMITS[field]
    sentences = split_sentences(text.strip())[:count]
    for end in range(len(sentences), 0, -1):
        kept = " ".join(sentences[:end])
        if kept and len(kept) <= longest:
            return kept
    return None


def _repeats(text: str, earlier: str | None) -> bool:
    """Whether the line was already said in an earlier reply of this conversation."""
    if not earlier:
        return False
    line, before = " ".join(words(text)), " ".join(words(earlier))
    return bool(line) and line in before


def screened(
    lines: dict[str, str],
    passages: list[Passage],
    language: Language,
    earlier: str | None = None,
) -> dict[str, str]:
    """The warm lines that pass the code checks, shortened to their limits."""
    runs = book_runs_of(passages)
    kept: dict[str, str] = {}
    for field, text in lines.items():
        line = _short(field, text or "")
        if line is None:
            continue
        marked = MARKER.search(canonical_markers(line)) or PLACEHOLDER.search(line)
        bracketed = "﴿" in line or "﴾" in line
        if marked or bracketed or copied_from(line, passages, runs) is not None:
            continue
        # The name placeholder is filled on the device; it is not part of the line's language.
        if not written_in(without_name(line), language) or _repeats(line, earlier):
            continue
        kept[field] = line
    return kept
