"""Reads a PDF's clickable contents pages, for scripts/sources/islamhouse-books.mjs. Run through uv:

    uv run --no-project --with pypdf python scripts/sources/pdf_contents.py <pdf>

Some books (laid out in InDesign) open with contents pages whose entries are links to the
chapters. For every link box that encloses text, this prints the page it sits on, the page it
leads to, and the text inside the box: each fragment exactly as extracted, and the longest one
as the entry's title. Small link boxes (page-turn arrows, under MIN_HEIGHT points tall) and boxes
without text are left out. Prints JSON.
"""

import json
import sys
from pathlib import Path

from pypdf import PdfReader
from pypdf.generic import ArrayObject, Destination, DictionaryObject

MIN_HEIGHT = 30


def target_page(
    reader: PdfReader, named: dict[str, Destination], link: DictionaryObject
) -> int | None:
    destination = link.get("/Dest")
    action = link.get("/A")
    if destination is None and action is not None:
        destination = action.get_object().get("/D")
    if destination is None:
        return None
    destination = destination.get_object()
    if isinstance(destination, ArrayObject):
        return reader.get_page_number(destination[0].get_object()) + 1
    found = named.get(str(destination))
    return None if found is None else reader.get_destination_page_number(found) + 1


def contents(path: Path) -> list[dict[str, object]]:
    reader = PdfReader(path)
    named = reader.named_destinations
    entries: list[dict[str, object]] = []
    for number, page in enumerate(reader.pages, start=1):
        boxes = []
        for annotation in page.get("/Annots") or []:
            link = annotation.get_object()
            if link.get("/Subtype") != "/Link":
                continue
            rect = [float(value) for value in link["/Rect"]]
            left, right = sorted(rect[0::2])
            bottom, top = sorted(rect[1::2])
            if top - bottom >= MIN_HEIGHT:
                boxes.append((link, left, right, bottom, top))
        if not boxes:
            continue
        fragments: list[tuple[float, float, str]] = []

        def collect(
            text: str,
            cm: list[float],
            tm: list[float],
            _font: object,
            _size: object,
            into: list[tuple[float, float, str]] = fragments,
        ) -> None:
            if text.strip():
                into.append((tm[4] * cm[0] + cm[4], tm[5] * cm[3] + cm[5], text.strip()))

        page.extract_text(visitor_text=collect)
        for link, left, right, bottom, top in boxes:
            inside = [text for x, y, text in fragments if left <= x <= right and bottom <= y <= top]
            target = target_page(reader, named, link)
            if inside and target is not None:
                entries.append(
                    {
                        "page": number,
                        "target": target,
                        "title": max(inside, key=len),
                        "fragments": inside,
                    }
                )
    return entries


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
    print(json.dumps(contents(Path(sys.argv[1])), ensure_ascii=False))
