"""Phrasing a speaker already used in this conversation: the same opening, or a run of words said
before. Used for Rafiq's own replies (his openings, referral openings included) and for the other
person in a Mawqif practice."""

from app.text import words

RUN_WORDS = 4
# An opening repeats when the first two words match, or the first word alone when it carries the
# pattern by itself («أتفهم…», «أهلاً…»), not a short function word ("I", «أنت»).
OPENING_WORDS = 2
PATTERN_WORD = 4


def _runs(found: list[str]) -> set[tuple[str, ...]]:
    return {tuple(found[i : i + RUN_WORDS]) for i in range(len(found) - RUN_WORDS + 1)}


def same_opening(text: str, other: str) -> str | None:
    first, second = words(text), words(other)
    if not first or not second:
        return None
    if first[:OPENING_WORDS] == second[:OPENING_WORDS] and len(first) >= OPENING_WORDS:
        return " ".join(first[:OPENING_WORDS])
    if first[0] == second[0] and len(first[0]) >= PATTERN_WORD:
        return first[0]
    return None


def shared_run(text: str, earlier: list[str]) -> str | None:
    """A run of words of `text` already said in one of the `earlier` texts."""
    runs = _runs(words(text))
    for line in earlier:
        if shared := runs & _runs(words(line)):
            return " ".join(min(shared))
    return None


def repeated(text: str, earlier: list[str]) -> str | None:
    """The words of `text` already said in one of the `earlier` lines (its opening, or a run of
    words), or None when it is new."""
    for line in earlier:
        if opening := same_opening(text, line):
            return opening
    return shared_run(text, earlier)
