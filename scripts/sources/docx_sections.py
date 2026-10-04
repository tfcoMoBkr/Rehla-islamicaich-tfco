"""Splits a DOCX book at its own headings, for scripts/sources/byenah.mjs. Run through uv:

    uv run --no-project --with python-docx python scripts/sources/docx_sections.py <docx>

Prints JSON: the book's sections in order, each with its heading (level 1 or 2, or the title for
the front matter) and its paragraphs, each paragraph's text exactly as the document has it and the
name of its style (e.g. the style the book uses for Quran verses). Empty paragraphs are skipped.
"""

import json
import sys
from pathlib import Path

from docx import Document

HEADING_LEVELS = {"Title": 0, "Heading 1": 1, "Heading 2": 2}


def sections(path: Path) -> list[dict[str, object]]:
    found: list[dict[str, object]] = []
    current: dict[str, object] | None = None
    for paragraph in Document(str(path)).paragraphs:
        text = paragraph.text
        if not text.strip():
            continue
        style = paragraph.style.name if paragraph.style is not None else ""
        if style in HEADING_LEVELS:
            current = {"heading": text, "level": HEADING_LEVELS[style], "paragraphs": []}
            found.append(current)
            continue
        if current is None:
            current = {"heading": None, "level": 0, "paragraphs": []}
            found.append(current)
        paragraphs = current["paragraphs"]
        assert isinstance(paragraphs, list)
        paragraphs.append({"index": len(paragraphs) + 1, "style": style, "text": text})
    return found


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
    print(json.dumps(sections(Path(sys.argv[1])), ensure_ascii=False))
