"""Verification in code, and the verbatim insertion of verses and hadiths."""

import json

from app.config import get_settings
from app.index import Index
from app.languages import Language
from app.rafiq.check import code_problems
from app.rafiq.compose import compose
from app.rafiq.draft import parse, render
from app.rafiq.repair import repair
from app.rafiq.schemas import HadithBlock, QuranBlock, TextBlock
from app.retrieval.passages import Passage, from_chunk, from_hadith_chunks

from .fakes import VERSE, WUDU


def passages() -> list[Passage]:
    return [
        from_chunk(WUDU).model_copy(update={"n": 1}),
        from_chunk(VERSE).model_copy(update={"n": 2}),
    ]


def kinds(
    answer: str,
    required: str | None = None,
    given: list[Passage] | None = None,
    language: Language | None = None,
) -> set[str]:
    found = code_problems(parse(answer), given or passages(), required, language)
    return {problem.kind for problem in found}


def test_a_cited_answer_passes() -> None:
    assert kinds("You wash your face and your feet [1].\n{{quran:2:256}}") == set()


def test_prose_must_be_in_the_answer_language() -> None:
    english = "You wash your face and your feet [1]."
    assert kinds(english, language="en") == set()
    assert kinds(english, language="ar") == {"wrongLanguage"}
    assert kinds("تغسل وجهك ثم يديك إلى المرفقين، وهذا هو الـ wudu [1].", language="ar") == set()


def test_a_sentence_in_another_language_is_removed_and_the_block_stays() -> None:
    units = parse("You wash your face and your feet [1].\n{{quran:2:256}}")
    problems = code_problems(units, passages(), None, "ar")
    repaired = repair(units, problems, passages(), None, "ar")

    assert repaired is not None
    assert render(repaired).strip() == "{{quran:2:256}}"


def test_a_sentence_no_marker_covers_is_rejected() -> None:
    assert kinds("You wash your face and your feet before prayer.") == {"unmarked"}


def test_a_marker_without_a_passage_is_rejected() -> None:
    assert kinds("You wash your face and your feet [7].") == {"unknownMarker"}


def test_a_placeholder_without_a_passage_is_rejected() -> None:
    assert kinds("Read this verse [2].\n{{quran:3:19}}") == {"unknownBlock"}


def test_verse_words_written_outside_their_block_are_rejected() -> None:
    copied = "The verse says there shall be no compulsion in acceptance of the religion [2]."

    assert kinds(copied) == {"copiedSacred"}


def test_a_misquoted_verse_must_be_shown() -> None:
    assert kinds("The wording is a little different [2].", required="2:256") == {"missingVerse"}


def test_a_short_lead_in_to_a_verse_needs_no_marker() -> None:
    answer = "The wording is a little different [2].\nThe verse is:\n{{quran:2:256}}"

    assert kinds(answer, required="2:256") == set()


def test_a_long_claim_ending_in_a_colon_still_needs_a_marker() -> None:
    answer = "Every person must always remember these seven separate things on every day:\n"
    answer += "{{quran:2:256}}"

    assert kinds(answer) == {"unmarked"}


def test_words_a_book_shares_with_a_verse_may_be_taken_from_the_book() -> None:
    book = from_chunk(WUDU).model_copy(
        update={
            "n": 1,
            "text": "It says there shall be no compulsion in acceptance of the religion.",
        }
    )
    copied = "There shall be no compulsion in acceptance of the religion [1]."
    verse = from_chunk(VERSE).model_copy(update={"n": 2})

    assert kinds(copied, given=[book, verse]) == set()


def stored(kind: str, name: str) -> dict:
    path = get_settings().content_dir / "fetched" / kind / f"{name}.json"
    data: dict = json.loads(path.read_text(encoding="utf-8"))
    return data


def test_blocks_carry_the_stored_texts_byte_for_byte() -> None:
    """From the committed index to the response, compared with the files the texts came from."""
    built = Index.load(get_settings().index_dir)
    hadith_id = next(c.extra["hadithId"] for c in built.chunks if c.type == "hadith")
    chunks = [c for c in built.chunks if c.type == "hadith" and c.extra["hadithId"] == hadith_id]
    arabic = next(str(c.extra["hadith"]) for c in chunks if c.lang == "ar")
    english = [c for c in chunks if c.lang == "en"]
    verse_chunk = next(c for c in built.chunks if c.type == "quran" and c.lang == "en")
    numbered = [
        from_hadith_chunks(english, arabic).model_copy(update={"n": 1}),
        from_chunk(verse_chunk).model_copy(update={"n": 2}),
    ]
    reference = verse_chunk.reference
    units = parse(f"Explanation [1].\n{{{{hadith:{hadith_id}}}}}\n{{{{quran:{reference}}}}}")

    blocks = compose(units, numbered, "en", "A").blocks

    published = stored("hadith", str(hadith_id))["languages"]
    surah, ayah = reference.split(":")
    verse_file = stored("quran", f"{surah}-{ayah}")
    translation = verse_file["translations"]["en"]
    assert isinstance(blocks[0], TextBlock)
    assert isinstance(blocks[1], HadithBlock)
    assert blocks[1].arabic.encode() == published["ar"]["hadeeth"].encode()
    assert (blocks[1].text or "").encode() == published["en"]["hadeeth"].encode()
    assert isinstance(blocks[2], QuranBlock)
    assert blocks[2].arabic.encode() == verse_file["arabic"].encode()
    assert (blocks[2].translation or "").encode() == translation["text"].encode()
    assert blocks[2].translation_version == translation["version"]
