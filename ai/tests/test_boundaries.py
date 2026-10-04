"""Where Rafiq meets the outside: MCP results, model replies and the HTTP API.

The MCP samples below copy the server's format with placeholder words, not real texts."""

import pytest
from fastapi.testclient import TestClient

from app.api import RateLimiter, Services
from app.llm import extract_json
from app.main import app
from app.retrieval.mcp_text import (
    parse_hadith,
    parse_hadith_versions,
    parse_search,
    parse_verses,
)
from app.retrieval.passages import from_mcp_hadith

HADITH = """──────── RETRIEVED FROM HADEETHENC — published text ────────

Title of the hadith

[EXACT] the narration itself — reproduce these words exactly
Narration text, line one.
Line two.
[/EXACT]

[ATTRIBUTION] the names, grades and links exactly as HadeethEnc recorded them
Narrator: Narrated by someone

Grade: Authentic
[/ATTRIBUTION]

[COMMENTARY] HadeethEnc's own words
Explanation: Explanation text.

Benefits:
- A benefit.
[/COMMENTARY]

Source: https://hadeethenc.com/en/browse/hadith/42
"""

VERSES = """──────── RETRIEVED FROM QURANENC — published text ────────

[EXACT] the verses and their published translation
[1:1]
ARABIC ONE
Translation one.

[1:2]
ARABIC TWO
[All] translation two, starting with a bracket.
[/EXACT]

Source: https://islamenc.com/en/quran/1/1
"""


def test_a_hadith_is_read_from_its_exact_block() -> None:
    hadith = parse_hadith(42, HADITH, "en")

    assert hadith is not None
    assert hadith.text == "Narration text, line one.\nLine two."
    assert (hadith.grade, hadith.attribution) == ("Authentic", "Narrated by someone")
    assert hadith.explanation == "Explanation text."
    assert hadith.url == "https://hadeethenc.com/en/browse/hadith/42"


# Arabic with tashkeel and a line that ends in two spaces: kept exactly as it arrives.
MULTILINGUAL = """──────── RETRIEVED FROM HADEETHENC — published text ────────

[ar — العربية]
عنوان قصير

[EXACT] the narration itself — reproduce these words exactly
نَصٌّ عَرَبِيٌّ، بِعَلَامَاتِهِ{trailing}
وسطرٌ ثانٍ.
[/EXACT]

[ATTRIBUTION] the names, grades and links exactly as HadeethEnc recorded them
Narrator: راوٍ

Grade: درجة
[/ATTRIBUTION]

Source: https://hadeethenc.com/ar/browse/hadith/42

────────

[ur — اردو]
مختصر عنوان

[EXACT] the narration itself — reproduce these words exactly
اردو متن کی پہلی سطر۔
[/EXACT]

[ATTRIBUTION] the names, grades and links exactly as HadeethEnc recorded them
Narrator: راوی

Grade: درجہ
[/ATTRIBUTION]

[COMMENTARY] HadeethEnc's own words
Explanation: ناشر کی وضاحت۔
[/COMMENTARY]

Source: https://hadeethenc.com/ur/browse/hadith/42
""".replace("{trailing}", "  ")


def test_each_language_of_a_hadith_is_read_byte_for_byte() -> None:
    versions = parse_hadith_versions(42, MULTILINGUAL, "ar")

    assert set(versions) == {"ar", "ur"}
    lines = ["نَصٌّ عَرَبِيٌّ، بِعَلَامَاتِهِ  ", "وسطرٌ ثانٍ."]
    assert versions["ar"].text.encode() == "\n".join(lines).encode()
    passage = from_mcp_hadith(versions, "ur")
    assert passage is not None
    assert passage.hadith is not None
    assert passage.lang == "ur"
    assert passage.hadith.arabic == versions["ar"].text
    assert passage.hadith.text == "اردو متن کی پہلی سطر۔"
    assert passage.hadith.explanation == "ناشر کی وضاحت۔"
    assert passage.hadith.url == "https://hadeethenc.com/ur/browse/hadith/42"


def test_a_hadith_in_no_wanted_language_gives_no_passage() -> None:
    versions = parse_hadith_versions(42, MULTILINGUAL, "ar")

    assert from_mcp_hadith(versions, "fr") is None


def test_verses_keep_a_translation_that_starts_with_a_bracket() -> None:
    verses = parse_verses(VERSES, with_translation=True)

    assert [(v.surah, v.ayah, v.arabic) for v in verses] == [
        (1, 1, "ARABIC ONE"),
        (1, 2, "ARABIC TWO"),
    ]
    assert verses[1].translation == "[All] translation two, starting with a bracket."
    assert parse_verses(VERSES, with_translation=False)[0].translation is None


def test_search_reads_only_the_json_block() -> None:
    hit = '{"id":"hadith:42:en","title":"T","url":"https://hadeethenc.com/en/browse/hadith/42"}'
    text = '{"results":[' + hit + "]}\n1. [hadith] T"

    assert [hit.id for hit in parse_search(text)] == ["hadith:42:en"]
    assert parse_search("no results") == []


def test_json_is_found_in_fenced_or_thinking_replies() -> None:
    assert extract_json('```json\n{"a": 1}\n```') == {"a": 1}
    assert extract_json('<think>{"no": 1}</think> Here: {"a": "}"} done') == {"a": "}"}
    with pytest.raises(ValueError, match="no JSON"):
        extract_json("no object")


@pytest.fixture
def client() -> TestClient:
    with TestClient(app) as test_client:
        test_client.app.state.services = Services(rafiq=None, limiter=RateLimiter(2))  # type: ignore[attr-defined]
        yield test_client


def test_an_invalid_request_names_the_field_but_never_echoes_it(client: TestClient) -> None:
    secret = "x" * 1001
    response = client.post("/ask", json={"question": secret, "locale": "en"})

    assert response.status_code == 422
    body = response.json()
    assert body["error"]["code"] == "invalid_request"
    assert body["error"]["fields"][0]["field"] == "question"
    assert secret not in response.text


def test_without_models_the_service_says_it_is_unavailable(client: TestClient) -> None:
    response = client.post("/ask", json={"question": "What is wudu?", "locale": "en"})

    assert response.status_code == 503
    assert response.json() == {"error": {"code": "unavailable"}}


def test_too_many_questions_are_rate_limited(client: TestClient) -> None:
    for _ in range(2):
        client.post("/ask", json={"question": "What is wudu?", "locale": "en"})
    response = client.post("/ask", json={"question": "What is wudu?", "locale": "en"})

    assert response.status_code == 429
    assert response.json()["error"]["code"] == "rate_limited"
    assert "Retry-After" in response.headers
