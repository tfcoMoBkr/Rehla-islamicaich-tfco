"""PDF helpers for scripts/fetch-content.mjs, run through uv:

    uv run --no-project --with pypdf --with pillow python scripts/pdf_tools.py text <pdf>
    uv run --no-project --with pypdf --with pillow python scripts/pdf_tools.py \
        images <pdf> <out-dir>

`text` prints each page's text exactly as extracted, both plain and laid out as on the page
(the layout keeps paragraph indents, which the plain text loses). `images` saves the embedded
images as p<page>-<n>.jpg|png: JPEG bytes are written as they are; anything else (including a
JPEG drawn through a transparency mask) is written losslessly as PNG with its mask applied, so it
looks as it does in the book. Nothing is cropped or resized. Slivers (rules and borders under
MIN_SIDE pixels wide) and exact repeats of an image already saved are skipped and listed.
Both commands print JSON.
"""

import hashlib
import json
import sys
from pathlib import Path

from pypdf import PdfReader

MIN_SIDE = 40


def page_texts(pdf: Path) -> list[dict[str, object]]:
    reader = PdfReader(pdf)
    return [
        {
            "page": number,
            "text": page.extract_text() or "",
            "layout": page.extract_text(extraction_mode="layout") or "",
        }
        for number, page in enumerate(reader.pages, start=1)
    ]


def page_images(pdf: Path, out_dir: Path) -> dict[str, list[dict[str, object]]]:
    reader = PdfReader(pdf)
    out_dir.mkdir(parents=True, exist_ok=True)
    saved: list[dict[str, object]] = []
    skipped: list[dict[str, object]] = []
    seen: dict[str, str] = {}
    for number, page in enumerate(reader.pages, start=1):
        for index, image in enumerate(page.images, start=1):
            width, height = image.image.size
            digest = hashlib.sha256(image.image.tobytes()).hexdigest()
            if min(width, height) < MIN_SIDE:
                skipped.append(
                    {
                        "page": number,
                        "index": index,
                        "width": width,
                        "height": height,
                        "reason": "sliver",
                    }
                )
                continue
            if digest in seen:
                skipped.append(
                    {"page": number, "index": index, "reason": f"repeat of {seen[digest]}"}
                )
                continue
            is_jpeg = image.name.lower().endswith((".jpg", ".jpeg"))
            name = f"p{number:02d}-{index}.{'jpg' if is_jpeg else 'png'}"
            if is_jpeg:
                (out_dir / name).write_bytes(image.data)
            else:
                image.image.save(out_dir / name, format="PNG")
            seen[digest] = name
            saved.append({"file": name, "page": number, "width": width, "height": height})
    return {"saved": saved, "skipped": skipped}


def main(args: list[str]) -> None:
    command, pdf = args[0], Path(args[1])
    if command == "text":
        result: object = page_texts(pdf)
    elif command == "images":
        result = page_images(pdf, Path(args[2]))
    else:
        raise SystemExit(f"Unknown command {command!r}")
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main(sys.argv[1:])
