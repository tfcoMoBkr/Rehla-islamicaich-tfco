"""byenah.com: «ما لا يسع أطفال المسلمين جهله» / "What Muslim Children Must Know", Arabic and English
(byenah.com/ar/muslim-content/21227, /en/muslim-content/5138), split question by question into the
corpus (content/corpus/books/, git-ignored) for app/ingest.py, and registered in its index.

Input: the book's text as byenah.com publishes it, one JSON object per row (item_id, language,
title, url, text_source), as the Association's corpus export gives it. The text is kept as it is:
each question with its answer, nothing reworded. The book's table of contents is left out.

    python scripts/sources/byenah_children.py path/to/rows.jsonl
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CORPUS = ROOT / "content" / "corpus"
EDITIONS = {
    "ar": {"id": "byenah-21227", "item": "byenah:21227:ar", "url": "https://byenah.com/ar/muslim-content/21227"},
    "en": {"id": "byenah-5138", "item": "byenah:5138:en", "url": "https://byenah.com/en/muslim-content/5138"},
}
# The day the rows were taken from byenah.com.
FETCHED_ON = "2026-10-04"
TITLES = {"ar": "ما لا يسع أطفال المسلمين جهله", "en": "What Muslim Children Must Know"}
# The start of a question: «س19-» / «س١8:» in Arabic, "Q20:" in English.
QUESTION = {
    "ar": re.compile(r"^\s*س\s*[\d٠-٩]+\s*[-:ـ]", re.MULTILINE),
    "en": re.compile(r"^\s*Q\d+\s*:", re.MULTILINE),
}
ANSWER = {"ar": re.compile(r"^\s*ج\s*[-:ـ]\s*", re.MULTILINE), "en": re.compile(r"^\s*Answer\s*:\s*", re.MULTILINE)}
# A table-of-contents line ends with its page number after a tab or a row of dots.
CONTENTS_LINE = re.compile(r"(?:\t|\.{4,})\s*\d+\s*$")


def text_of(rows: list[dict[str, str]], language: str) -> str:
    """The edition's text, its parts in order."""
    prefix = EDITIONS[language]["item"]
    parts = [row for row in rows if row["item_id"] == prefix or row["item_id"].startswith(prefix + ":p")]
    parts.sort(key=lambda row: int(row["item_id"].rsplit(":p", 1)[1]) if ":p" in row["item_id"] else 0)
    return "\n".join(row["text_source"] for row in parts)


def sections(text: str, language: str) -> list[dict[str, object]]:
    starts = [match.start() for match in QUESTION[language].finditer(text)]
    found: list[dict[str, object]] = []
    for number, start in enumerate(starts, start=1):
        end = starts[number] if number < len(starts) else len(text)
        block = text[start:end].strip()
        if any(CONTENTS_LINE.search(line) for line in block.splitlines()[:2]):
            continue
        answer = ANSWER[language].search(block)
        if answer is None:
            continue
        question = block[: answer.start()].strip()
        reply = block[answer.end() :].strip()
        if not question or not reply:
            continue
        anchor = f"q{len(found) + 1}"
        found.append(
            {
                "book": EDITIONS[language]["id"],
                "language": language,
                "anchor": anchor,
                "heading": question,
                "source": {"url": EDITIONS[language]["url"], "publisher": "byenah.com", "fetchedOn": FETCHED_ON},
                "paragraphs": [
                    {"index": 1, "part": "question", "text": question},
                    {"index": 2, "part": "summary", "text": reply},
                ],
            }
        )
    return found


def main(rows_path: Path) -> None:
    rows = [json.loads(line) for line in rows_path.read_text(encoding="utf-8").splitlines() if line.strip()]
    index_path = CORPUS / "index.json"
    index = json.loads(index_path.read_text(encoding="utf-8"))
    for language, edition in EDITIONS.items():
        found = sections(text_of(rows, language), language)
        directory = CORPUS / "books" / edition["id"]
        directory.mkdir(parents=True, exist_ok=True)
        for old in directory.glob("*.json"):
            old.unlink()
        for section in found:
            (directory / f"{section['anchor']}.json").write_text(
                json.dumps(section, ensure_ascii=False, indent=1), encoding="utf-8"
            )
        (directory / "index.json").write_text(
            json.dumps(
                {"id": edition["id"], "language": language, "title": TITLES[language], "url": edition["url"], "chunking": "question"},
                ensure_ascii=False,
                indent=1,
            ),
            encoding="utf-8",
        )
        entry = {
            "id": edition["id"],
            "language": language,
            "title": TITLES[language],
            "url": edition["url"],
            "path": f"content/corpus/books/{edition['id']}",
            "stored": "content/corpus (git-ignored, rebuilt by scripts/sources/byenah_children.py)",
            "characters": sum(len(str(p["text"])) for s in found for p in s["paragraphs"]),  # type: ignore[union-attr]
        }
        index["books"] = [book for book in index["books"] if book["id"] != edition["id"]] + [entry]
        print(language, len(found), "questions")
    index_path.write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main(Path(sys.argv[1]))
