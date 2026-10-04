"""Reading the MCP server's results. Verses and hadiths arrive between [EXACT] markers; only that
text is ever shown as a verse or a hadith, exactly as it arrived: the lines between the markers are
kept whole, without trimming or any other change."""

import json
import re

from pydantic import BaseModel


class McpHadith(BaseModel):
    id: int
    language: str
    title: str
    text: str
    grade: str
    attribution: str
    explanation: str
    url: str


class McpVerse(BaseModel):
    surah: int
    ayah: int
    arabic: str
    translation: str | None
    url: str


class SearchHit(BaseModel):
    id: str
    title: str
    url: str


_LANGUAGE_SECTION = re.compile(r"^\[([a-z]{2,3}) — [^\]\n]+\]$", flags=re.MULTILINE)


def _between(text: str, start: str, end: str) -> str | None:
    """The lines between a marker line and its closing marker, untouched."""
    match = re.search(rf"\[{start}\][^\n]*\n(.*?)\n\[/{end}\]", text, flags=re.DOTALL)
    return match.group(1) if match else None


def _field(block: str | None, label: str) -> str:
    if not block:
        return ""
    match = re.search(
        rf"^{label}:\s*(.*?)(?=\n\n[A-Z][\w ]*:|\Z)", block, flags=re.DOTALL | re.MULTILINE
    )
    return match.group(1).strip() if match else ""


def parse_hadith_versions(hadith_id: int, text: str, requested: str) -> dict[str, McpHadith]:
    """Each language section of a get_hadith reply; a single-language reply has no section heads."""
    heads = list(_LANGUAGE_SECTION.finditer(text))
    if not heads:
        hadith = parse_hadith(hadith_id, text, requested)
        return {requested: hadith} if hadith else {}
    versions: dict[str, McpHadith] = {}
    for index, head in enumerate(heads):
        end = heads[index + 1].start() if index + 1 < len(heads) else len(text)
        hadith = parse_hadith(hadith_id, text[head.start() : end], head.group(1))
        if hadith:
            versions[head.group(1)] = hadith
    return versions


def parse_hadith(hadith_id: int, text: str, language: str) -> McpHadith | None:
    exact = _between(text, "EXACT", "EXACT")
    if not exact or not exact.strip():
        return None
    title = re.search(
        r"(?:RETRIEVED FROM[^\n]*|^\[[a-z]{2,3} — [^\]\n]+\])\n+([^\n[]+)", text, flags=re.M
    )
    url = re.search(r"^Source:\s*(\S+)", text, flags=re.MULTILINE)
    attribution = _between(text, "ATTRIBUTION", "ATTRIBUTION")
    commentary = _between(text, "COMMENTARY", "COMMENTARY")
    return McpHadith(
        id=hadith_id,
        language=language,
        title=title.group(1).strip() if title else "",
        text=exact,
        grade=_field(attribution, "Grade"),
        attribution=_field(attribution, "Narrator"),
        explanation=_field(commentary, "Explanation"),
        url=url.group(1) if url else f"https://hadeethenc.com/{language}/browse/hadith/{hadith_id}",
    )


def parse_verses(text: str, with_translation: bool) -> list[McpVerse]:
    exact = _between(text, "EXACT", "EXACT")
    if not exact:
        return []
    url = re.search(r"^Source:\s*(\S+)", text, flags=re.MULTILINE)
    # Each verse is "[s:a]", its Arabic line, then its translation (which may start with "[").
    verses: list[McpVerse] = []
    current: list[str] = []
    reference: tuple[int, int] | None = None

    def close() -> None:
        if reference and current:
            translation = "\n".join(current[1:]) or None
            verses.append(
                McpVerse(
                    surah=reference[0],
                    ayah=reference[1],
                    arabic=current[0],
                    translation=translation if with_translation else None,
                    url=url.group(1) if url else "https://quranenc.com",
                )
            )

    for line in exact.splitlines():
        marker = re.fullmatch(r"\[(\d+):(\d+)\]", line.strip())
        if marker:
            close()
            reference, current = (int(marker.group(1)), int(marker.group(2))), []
        elif line.strip():
            current.append(line)
    close()
    return verses


def parse_search(text: str) -> list[SearchHit]:
    """The JSON block of a search result (the first block); readable blocks are ignored."""
    for block in text.split("\n"):
        block = block.strip()
        if block.startswith('{"results"'):
            try:
                return [SearchHit.model_validate(hit) for hit in json.loads(block)["results"]]
            except (ValueError, KeyError):
                return []
    return []
