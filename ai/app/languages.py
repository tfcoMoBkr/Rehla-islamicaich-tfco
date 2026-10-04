"""The languages Rafiq answers in, as one table. Adding a language is adding an entry here (and its
row in web/src/lib/rafiq/languages.ts); no code branches on a particular language.

`local` languages have the lesson books and terms in the local index and are answered in full.
The others are answered extractively: published verse and hadith texts in that language, the
publisher's own explanation, and at most two connecting sentences (see docs/RELIABILITY.md).
"""

from dataclasses import dataclass
from typing import Literal

Language = Literal["ar", "en", "ur", "bn", "fr"]
# The languages the local index (books, terms, stored verses and hadiths) is written in.
IndexLanguage = Literal["ar", "en"]


@dataclass(frozen=True)
class QuranTranslation:
    """A QuranEnc translation, as listed by list_quran_translations and QuranEnc's API."""

    key: str
    name: str
    version: str


@dataclass(frozen=True)
class LanguageSpec:
    code: Language
    name: str
    direction: Literal["rtl", "ltr"]
    # None for Arabic (the verse is the text) and for a language QuranEnc has no translation in.
    quran: QuranTranslation | None
    hadeethenc: str
    local: bool


ENGLISH_SAHEEH = QuranTranslation(
    "english_saheeh", "English Translation - Noor International Center", "1.1.2"
)

LANGUAGES: dict[Language, LanguageSpec] = {
    "ar": LanguageSpec("ar", "Modern Standard Arabic", "rtl", None, "ar", local=True),
    "en": LanguageSpec("en", "English", "ltr", ENGLISH_SAHEEH, "en", local=True),
    "ur": LanguageSpec(
        "ur",
        "Urdu",
        "rtl",
        QuranTranslation("urdu_junagarhi", "Urdu Translation - Muhammad Junagarhi", "1.1.3"),
        "ur",
        local=False,
    ),
    # QuranEnc publishes no Bengali translation: verses show the English one, labelled as such.
    "bn": LanguageSpec("bn", "Bengali", "ltr", None, "bn", local=False),
    "fr": LanguageSpec(
        "fr",
        "French",
        "ltr",
        QuranTranslation(
            "french_montada", "French translation - Noor International Center", "1.0.0"
        ),
        "fr",
        local=False,
    ),
}

# What a language without its own published text falls back to, shown and labelled as such.
FALLBACK: Language = "en"
# Questions in a language not in the table are answered in this one, with a line saying so.
DEFAULT: Language = "en"


def spec(language: Language) -> LanguageSpec:
    return LANGUAGES[language]


def quran_translation(language: Language) -> tuple[Language, QuranTranslation] | None:
    """The translation shown beside a verse for this language, and the language it is in."""
    if language == "ar":
        return None
    own = LANGUAGES[language].quran
    if own:
        return language, own
    fallback = LANGUAGES[FALLBACK].quran
    return (FALLBACK, fallback) if fallback else None
