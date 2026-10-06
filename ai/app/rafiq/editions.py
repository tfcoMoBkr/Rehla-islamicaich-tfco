"""The books Rafiq cites that are published in both Arabic and English. When an answer draws on
one edition and is written in the other language, its source card names the edition in the
answer's language, so an Arabic answer never sends the reader to the English book."""

from dataclasses import dataclass

from app.retrieval.passages import Passage


@dataclass(frozen=True)
class Edition:
    lang: str
    source_id: str
    title: str
    url: str
    publisher: str


PAIRS = [
    (
        Edition(
            "en",
            "byenah-children",
            "What Muslim Children Must Know",
            "https://byenah.com/en/muslim-content/5138",
            "byenah.com",
        ),
        Edition(
            "ar",
            "byenah-children",
            "ما لا يسع أطفال المسلمين جهله",
            "https://byenah.com/ar/muslim-content/21227",
            "byenah.com",
        ),
    ),
    (
        Edition(
            "en",
            "byenah-new-muslim-guideline",
            "New Muslim Guideline",
            "https://byenah.com/en/muslim-content/4784",
            "byenah.com",
        ),
        Edition(
            "ar",
            "ih-almukhtasar-almufid",
            "المختصر المفيد للمسلم الجديد",
            "https://islamhouse.com/ar/books/2831443/",
            "IslamHouse.com",
        ),
    ),
    (
        Edition(
            "en",
            "risala-important-lessons",
            "IMPORTANT LESSONS FOR THE GENERAL UMMAH",
            "https://islamhouse.com/en/books/2842316/",
            "IslamHouse.com",
        ),
        Edition(
            "ar",
            "ih-durus-muhimmah",
            "الدروس المهمة لعامة الأمة",
            "https://islamhouse.com/ar/books/1871/",
            "IslamHouse.com",
        ),
    ),
    (
        Edition(
            "en",
            "ih-salat-nabi",
            "Prophet Manner of Performing Prayer",
            "https://islamhouse.com/en/books/1261/",
            "IslamHouse.com",
        ),
        Edition(
            "ar",
            "ih-salat-nabi",
            "كيفية صلاة النبي صلى الله عليه وسلم",
            "https://islamhouse.com/ar/books/62675/",
            "IslamHouse.com",
        ),
    ),
]


def edition_for(passage: Passage, language: str) -> Edition | None:
    """The same book's edition in `language`, for a book passage in another language."""
    if passage.type != "book" or passage.lang == language:
        return None
    for pair in PAIRS:
        if passage.url in (edition.url for edition in pair):
            return next((edition for edition in pair if edition.lang == language), None)
    return None
