"""Text forms used only to compare and to search: never shown, never stored in place of a text.

Arabic is compared without its tashkeel and tatweel and with one form each of alef, ya and ta
marbuta; Latin without diacritics and case.
"""

import re
import unicodedata

_TASHKEEL = re.compile(r"[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed]")
_TATWEEL = "\u0640"
_ALEF = re.compile(r"[\u0622\u0623\u0625\u0671]")
# Latin (with its extensions) ends before IPA extensions.
LATIN_END = 0x250
_ARABIC = re.compile(r"[\u0600-\u06ff]")

_STOPWORDS = {
    # Arabic particles and question words (after normalisation).
    "في",
    "من",
    "علي",
    "الي",
    "عن",
    "ما",
    "ماذا",
    "هل",
    "كيف",
    "كم",
    "لماذا",
    "متي",
    "اين",
    "هو",
    "هي",
    "ان",
    "او",
    "ثم",
    "لا",
    "مع",
    "هذا",
    "هذه",
    "ذلك",
    "التي",
    "الذي",
    "كل",
    "قد",
    "و",
    "يا",
    "انا",
    "نحن",
    "لي",
    "عند",
    "به",
    "بها",
    "له",
    "لها",
    "معني",
    # English.
    "the",
    "a",
    "an",
    "of",
    "and",
    "or",
    "to",
    "in",
    "on",
    "is",
    "are",
    "was",
    "be",
    "it",
    "its",
    "for",
    "with",
    "as",
    "by",
    "at",
    "what",
    "how",
    "why",
    "when",
    "does",
    "do",
    "did",
    "can",
    "i",
    "me",
    "my",
    "you",
    "your",
    "this",
    "that",
    "there",
    "which",
    "who",
    "about",
    "mean",
}


def normalize(text: str) -> str:
    """One comparable form for Arabic and Latin text."""
    text = _TASHKEEL.sub("", text).replace(_TATWEEL, "")
    text = _ALEF.sub("\u0627", text).replace("\u0649", "\u064a").replace("\u0629", "\u0647")
    decomposed = unicodedata.normalize("NFD", text)
    # Diacritics are dropped from Latin letters only: in other scripts marks are vowels.
    kept: list[str] = []
    for char in decomposed:
        if unicodedata.combining(char) and kept and ord(kept[-1]) < LATIN_END:
            continue
        kept.append(char)
    return unicodedata.normalize("NFC", "".join(kept)).lower()


def _words(text: str) -> list[str]:
    """Runs of letters, digits and marks: a vowel sign belongs to its word in every script."""
    found: list[str] = []
    current: list[str] = []
    for char in text:
        if unicodedata.category(char)[0] in "LNM":
            current.append(char)
        elif current:
            found.append("".join(current))
            current = []
    if current:
        found.append("".join(current))
    return found


def _light_stem(word: str) -> str:
    """Drops the Arabic conjunction and article ("و", "ال") so «الوضوء» and «وضوء» meet."""
    if word.startswith("وال") and len(word) > 5:
        return word[3:]
    if word.startswith("ال") and len(word) > 4:
        return word[2:]
    return word


def tokens(text: str) -> list[str]:
    """Search terms: normalised words without stop words, Arabic lightly stemmed."""
    words = _words(normalize(text))
    return [_light_stem(word) for word in words if word not in _STOPWORDS and len(word) > 1]


def words(text: str) -> list[str]:
    """Every normalised word, in order (for comparing passages word by word)."""
    return _words(normalize(text))


def has_arabic(text: str) -> bool:
    return bool(_ARABIC.search(text))


def shares_run(text: str, other: str, length: int) -> bool:
    """Whether two texts share `length` normalised words in a row."""
    first, second = words(text), words(other)
    runs = {tuple(first[i : i + length]) for i in range(len(first) - length + 1)}
    return any(tuple(second[i : i + length]) in runs for i in range(len(second) - length + 1))
