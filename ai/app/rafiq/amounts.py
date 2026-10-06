"""Amounts: a reply to "how many" or "how much" answers only with amounts its cited passages state.

A sentence that gives an amount must cite a passage in the reply's language that holds the same
numbers and most of the sentence's other words; one that does not is removed. A reply left with no
amount has not answered the question: the honest no-source card follows instead.
"""

import re

from app.retrieval.passages import Passage
from app.text import normalize, tokens, words

AMOUNT_QUESTION = re.compile(
    r"\bhow\s+(?:many|much)\b|(?:^|\s)كم(?:\s|$)|\bcombien\b|کتن[یےا]|কত|\bсколько\b|\bberapa\b",
    re.IGNORECASE,
)
NUMBER_WORDS = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8,
    "nine": 9, "ten": 10, "eleven": 11, "twelve": 12, "un": 1, "une": 1, "deux": 2, "trois": 3,
    "quatre": 4, "cinq": 5, "واحد": 1, "واحده": 1, "ركعه": 1, "ركعتان": 2, "ركعتين": 2,
    "اثنان": 2, "اثنتان": 2, "ثلاث": 3, "ثلاثه": 3, "اربع": 4, "اربعه": 4, "خمس": 5, "خمسه": 5,
    "ست": 6, "سته": 6, "سبع": 7, "سبعه": 7, "ثمان": 8, "ثماني": 8, "تسع": 9, "عشر": 10,
    "عشره": 10,
}  # fmt: skip
# Of a sentence's own words (numbers aside), the share its passage must hold.
SHARED_WORDS = 0.5
# The shortest stem of a counted thing that is matched in a sentence.
STEM_LETTERS = 3


# The obligatory and the voluntary form of an act of worship are different things to count.
OBLIGATORY = re.compile(
    r"فرض|فريض|مفروض|واجب|المكتوب|\b(?:obligatory|compulsory|fard|prescribed)\b", re.IGNORECASE
)
VOLUNTARY = re.compile(
    r"نافل|نوافل|تطوع|سنة|سنن|رواتب|يستحب|مستحب"
    r"|\b(?:voluntary|supererogatory|sunnah|recommended|optional)\b",
    re.IGNORECASE,
)


def _plain(text: str) -> str:
    """The text without its vowel signs, so «يُستحب» reads as «يستحب»."""
    return re.sub("[\u064b-\u0652]", "", text)


def same_form(sentence: str, asked: str) -> bool:
    """False when the sentence gives the amount of another form than the question asks about:
    the question names one form (obligatory or voluntary) and the sentence the other, or the
    question names neither, so it asks about the act itself (its obligatory form), and the sentence
    speaks of the voluntary one."""
    sentence, asked = _plain(sentence), _plain(asked)
    if not OBLIGATORY.search(asked) and not VOLUNTARY.search(asked):
        return not VOLUNTARY.search(sentence)
    for asked_form, other in ((OBLIGATORY, VOLUNTARY), (VOLUNTARY, OBLIGATORY)):
        if asked_form.search(asked) and not other.search(asked) and other.search(sentence):
            return False
    return True


def asks_amount(question: str) -> bool:
    return bool(AMOUNT_QUESTION.search(question))


def amounts(text: str) -> set[int]:
    """The numbers a text states, as digits (any script) or as number words."""
    found: set[int] = set()
    for word in words(text):
        if word.isdigit():
            found.add(int(word))
        elif word in NUMBER_WORDS:
            found.add(NUMBER_WORDS[word])
    return found


def about(sentence: str, things: list[str]) -> bool:
    """Whether the sentence speaks of one of the things counted (its first word's stem)."""
    if not things:
        return True
    text = normalize(sentence)
    for thing in things:
        first = (words(thing) or [""])[0]
        stem = re.sub(r"(?:s|ات|ه|ة|ان|ين)$", "", first)
        if len(stem) >= STEM_LETTERS and stem in text:
            return True
    return False


def stated_by(sentence: str, passage: Passage, language: str) -> bool:
    """Whether the passage, in the reply's language, states the sentence's amounts about the same
    thing: the same numbers, and most of the sentence's other words."""
    if passage.lang != language or not amounts(sentence) <= amounts(passage.text):
        return False
    own = {word for word in tokens(sentence) if word not in NUMBER_WORDS and not word.isdigit()}
    if not own:
        return True
    return len(own & set(tokens(passage.text))) / len(own) >= SHARED_WORDS
