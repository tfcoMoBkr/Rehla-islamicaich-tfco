"""Splits a question-and-answer book's PDF into one section per question, for
scripts/sources/dawa-center.mjs. Run through uv:

    uv run --no-project --with pypdf python scripts/sources/qa_sections.py <pdf>

Each page's text is taken exactly as the PDF text layer gives it. The running title, the chapter
running head and the printed page number at the top of each page are left out. A question starts
at its numbered heading; inside it, the book's own labels (the question, similar phrasings, the
answer's summary, the detailed answer, the closing, related questions, key words) mark its parts.
The headings and labels are set in a font whose letters partly extract out of order, so they are
recognised by what survives of them, and the parts keep only the text between them, unchanged.
Prints JSON: the sections, and the pages with letters in a private-use glyph font (verses).
"""

import json
import re
import sys
from pathlib import Path

# «المسألة 105» extracts as «الم105س», followed by the question's title.
QUESTION = re.compile(r"^\s*الم(\d+)س(.*)$")
PAGE_NUMBER = re.compile(r"^\s*\d+\s*$")
GLYPHS = re.compile(r"[-]")
# Part labels, as they extract: the first letters that survive, in order.
LABELS = [
    ("question", re.compile(r"^\s*السؤال\s*$")),
    ("similar", re.compile(r"^\s*عبارات\s+مشا")),
    ("answer", re.compile(r"^\s*الجواب\s*$")),
    ("content", re.compile(r"^\s*مضمو")),
    ("summary", re.compile(r"^\s*مختصَر")),
    ("detail", re.compile(r"^\s*الجواب\S*\s+التفصيل")),
    ("closing", re.compile(r"^\s*خاتِمة")),
    ("related", re.compile(r"^\s*أسئلة\s+ذات\s+علاقة")),
    ("keywords", re.compile(r"^\s*كلماتٌ\s+دل")),
]


def body_lines(page_text: str, running_title: str) -> list[str]:
    """The page's lines without the running heads and the printed page number above the text."""
    lines = page_text.split("\n")
    top = lines[:3]
    numbered = next((i for i, line in enumerate(top) if PAGE_NUMBER.match(line)), None)
    start = numbered + 1 if numbered is not None else 0
    return [line for line in lines[start:] if line.strip() != running_title]


def label_of(line: str) -> str | None:
    if len(line.strip()) > 40:
        return None
    return next((name for name, pattern in LABELS if pattern.match(line)), None)


def split(pdf: Path) -> dict[str, object]:
    from pypdf import PdfReader  # noqa: PLC0415 (only reading the PDF needs it)

    reader = PdfReader(pdf)
    pages = [page.extract_text() or "" for page in reader.pages]
    running_title = next(
        (line.strip() for text in pages for line in text.split("\n")[:3] if " - " in line), ""
    )
    sections: list[dict[str, object]] = []
    current: dict[str, object] | None = None
    part = "lead"
    for number, text in enumerate(pages, start=1):
        for line in body_lines(text, running_title):
            heading = QUESTION.match(line)
            if heading:
                current = {
                    "number": int(heading.group(1)),
                    "heading": heading.group(2).strip(),
                    "pages": [number],
                    "parts": [],
                }
                sections.append(current)
                part = "lead"
                continue
            if current is None:
                continue
            if number not in current["pages"]:  # type: ignore[operator]
                current["pages"].append(number)  # type: ignore[union-attr]
            label = label_of(line)
            if label:
                part = label
                continue
            parts: list[dict[str, object]] = current["parts"]  # type: ignore[assignment]
            if not parts or parts[-1]["part"] != part:
                parts.append({"part": part, "lines": []})
            parts[-1]["lines"].append(line)  # type: ignore[union-attr]
    for section in sections:
        section["parts"] = [
            {
                "part": item["part"],
                "text": "\n".join(item["lines"]).strip(),  # type: ignore[arg-type]
                **({"glyphs": True} if GLYPHS.search("".join(item["lines"])) else {}),  # type: ignore[arg-type]
            }
            for item in section["parts"]  # type: ignore[union-attr]
            if "\n".join(item["lines"]).strip()  # type: ignore[arg-type]
        ]
    return {
        "pages": len(pages),
        "runningTitle": running_title,
        "glyphPages": [n for n, text in enumerate(pages, start=1) if GLYPHS.search(text)],
        "sections": sections,
    }


if __name__ == "__main__":
    print(json.dumps(split(Path(sys.argv[1]))))
