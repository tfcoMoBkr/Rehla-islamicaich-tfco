"""The languages Rafiq answers in, as one table. Adding a language is adding an entry here (and its
row in web/src/lib/rafiq/languages.ts); no code branches on a particular language.

`local` languages have the lesson books and terms in the local index and are answered in full.
The others are answered extractively: published verse and hadith texts in that language, the
publisher's own explanation, and at most two connecting sentences (see docs/RELIABILITY.md).
"""

import re
from dataclasses import dataclass
from typing import Literal

Language = Literal["ar", "en", "ur", "bn", "fr"]
Script = Literal["arabic", "latin", "bengali"]
# The languages the local index (books, terms, stored verses and hadiths) is written in.
IndexLanguage = Literal["ar", "en"]


@dataclass(frozen=True)
class QuranTranslation:
    """A QuranEnc translation, as listed by list_quran_translations and QuranEnc's API."""

    key: str
    name: str
    # None when QuranEnc publishes no version number for it (its list endpoint omits it).
    version: str | None


@dataclass(frozen=True)
class LanguageSpec:
    code: Language
    name: str
    direction: Literal["rtl", "ltr"]
    # None for Arabic (the verse is the text) and for any language QuranEnc has no translation in.
    quran: QuranTranslation | None
    hadeethenc: str
    local: bool
    script: Script


ENGLISH_SAHEEH = QuranTranslation(
    "english_saheeh", "English Translation - Noor International Center", "1.1.2"
)

LANGUAGES: dict[Language, LanguageSpec] = {
    "ar": LanguageSpec(
        "ar", "Modern Standard Arabic", "rtl", None, "ar", local=True, script="arabic"
    ),
    "en": LanguageSpec("en", "English", "ltr", ENGLISH_SAHEEH, "en", local=True, script="latin"),
    "ur": LanguageSpec(
        "ur",
        "Urdu",
        "rtl",
        QuranTranslation("urdu_junagarhi", "Urdu Translation - Muhammad Junagarhi", "1.1.3"),
        "ur",
        local=False,
        script="arabic",
    ),
    "bn": LanguageSpec(
        "bn",
        "Bengali",
        "ltr",
        QuranTranslation("bengali_rwwad", "Bengali Translation - Rowwad Translation Center", None),
        "bn",
        local=False,
        script="bengali",
    ),
    "fr": LanguageSpec(
        "fr",
        "French",
        "ltr",
        QuranTranslation(
            "french_montada", "French translation - Noor International Center", "1.0.0"
        ),
        "fr",
        local=False,
        script="latin",
    ),
}

_LETTERS: dict[Script, re.Pattern[str]] = {
    "arabic": re.compile(r"[\u0620-\u064a\u066e-\u06d3\u06fa-\u06ff\u0750-\u077f]"),
    "latin": re.compile(r"[A-Za-z\u00c0-\u024f]"),
    "bengali": re.compile(r"[\u0980-\u09ff]"),
}
_ANY_LETTER = re.compile(r"[^\W\d_]")
# Below this many letters a line is too short to judge (a name, a term, a number).
_JUDGED_FROM = 12
# A line may carry a term or a name in another script; most of it must be in its own.
_OWN_SHARE = 0.6

# What a language without its own published text falls back to, shown and labelled as such.
FALLBACK: Language = "en"
# Questions in a language not in the table are answered in this one, with a line saying so.
DEFAULT: Language = "en"


def spec(language: Language) -> LanguageSpec:
    return LANGUAGES[language]


def written_in(text: str, language: Language) -> bool:
    """Whether a line of prose is written in the script of `language`."""
    letters = len(_ANY_LETTER.findall(text))
    if letters < _JUDGED_FROM:
        return True
    own = len(_LETTERS[LANGUAGES[language].script].findall(text))
    return own / letters >= _OWN_SHARE


def quran_translation(language: Language) -> tuple[Language, QuranTranslation] | None:
    """The translation shown beside a verse for this language, and the language it is in."""
    if language == "ar":
        return None
    own = LANGUAGES[language].quran
    if own:
        return language, own
    fallback = LANGUAGES[FALLBACK].quran
    return (FALLBACK, fallback) if fallback else None
