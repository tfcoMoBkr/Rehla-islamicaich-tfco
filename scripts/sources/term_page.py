"""Reads one term page of terminologyenc.com, for scripts/sources/terminologyenc.mjs.

Run through uv:

    uv run --no-project --with beautifulsoup4 python scripts/sources/term_page.py <html> <lang>

The site marks every field of a term with a note button whose data-det is "<id>/<field>/<lang>".
For the page's own language this prints each such field, the label of the part of the page it
sits in, and its text: tags removed and whitespace collapsed as a browser shows it, line breaks
kept, characters untouched. The page's references are printed the same way. Prints JSON.
"""

import json
import re
import sys
from pathlib import Path

from bs4 import BeautifulSoup, Tag

SPACES = re.compile(r"[ \t\r\n\f]+")


def visible_text(element: Tag) -> str:
    for line_break in element.find_all("br"):
        line_break.replace_with("\n")
    lines = [SPACES.sub(" ", line).strip() for line in element.get_text().split("\n")]
    return "\n".join(line for line in lines if line)


def section_label(element: Tag) -> str | None:
    toggle = element.find_parent(class_="toggle")
    label = toggle.find("label") if toggle else None
    return (visible_text(label) or None) if isinstance(label, Tag) else None


def fields(html: str, language: str) -> dict[str, object]:
    soup = BeautifulSoup(html, "html.parser")
    found: list[dict[str, str | None]] = []
    for button in soup.find_all(attrs={"data-det": True}):
        term_id, field, field_language = str(button["data-det"]).split("/")
        if field_language != language:
            continue
        block = button.parent
        if not isinstance(block, Tag):
            continue
        for extra in block.find_all(["button", "script"]):
            extra.decompose()
        for language_tag in block.find_all("span", class_="label"):
            language_tag.decompose()
        found.append(
            {
                "id": term_id,
                "field": field,
                "section": section_label(block),
                "text": visible_text(block),
            }
        )

    references = None
    for label in soup.find_all("label"):
        if visible_text(label) in ("References", "المراجع"):
            content = label.find_next_sibling(class_="toggle-content")
            references = visible_text(content) if isinstance(content, Tag) else None
            break
    title = soup.find("title")
    return {
        "pageTitle": visible_text(title) if isinstance(title, Tag) else None,
        "fields": found,
        "references": references,
    }


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
    print(
        json.dumps(
            fields(Path(sys.argv[1]).read_text(encoding="utf-8"), sys.argv[2]), ensure_ascii=False
        )
    )
