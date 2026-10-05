"""Writes docs/MAWQIF_COVERAGE.md from content/situations/*.json: each situation, every religious
statement in it (a quote), and the exact reference behind it. Run: python scripts/sources/mawqif-coverage.py
"""

import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
SITUATIONS = sorted((ROOT / "content" / "situations").glob("*.json"))

DROPPED = [
    ("Before sleep and on waking", "The two HadeethEnc hadiths found for it (65913, 65911) have no English version, so the situation could not be parallel in Arabic and English."),
    ("Parents or family who are not Muslim", "The only approved passage (al-Mukhtasar, Arabic s13 [4]) came out of the PDF with its words out of order, so it cannot be quoted verbatim; a situation about the learner's own family would also need a specialist rather than a role-play."),
    ("Breaking the fast at sunset", "No HadeethEnc hadith on the time of breaking the fast was found through the MCP search; the fasting situation uses the book's definition (from dawn to sunset) instead of a separate turn."),
    ("Following a funeral", "Named in Ibn Baz's list of manners and in hadith 3706, but the stored sources give no words to say or conduct to follow that a new Muslim could practise in a role-play."),
    ("Marriage, work conflict, money", "Personal matters: they would teach communication only, with no source giving words or conduct for a role-play; left to the specialist page."),
]


def reference(item: dict) -> str:
    if item["type"] == "hadith":
        return f"HadeethEnc hadith {item['hadeethencId']} ({item['citation']}), https://hadeethenc.com/en/browse/hadith/{item['hadeethencId']}"
    if item["type"] == "quran":
        surah, ayah = item["ref"].split(":")
        return f"Quran {item['ref']}, QuranEnc english_saheeh, https://quranenc.com/en/browse/english_saheeh/{surah}#{ayah}"
    ar, en = item["textRef"]["ar"], item["textRef"]["en"]
    return f"{item['source']}: ar {ar['book']}/{ar['section']} [{ar['paragraph']}], en {en['book']}/{en['section']} [{en['paragraph']}]"


def cell(text: str) -> str:
    return " ".join(text.split()).replace("|", "\\|")


lines = [
    "# Mawqif coverage",
    "",
    "Which everyday situations Mawqif teaches, and the source behind every religious statement in them. Generated from `content/situations/*.json` by `python scripts/sources/mawqif-coverage.py`; `web/src/lib/content/situation-content.test.ts` checks every quote against the stored source, byte for byte, in both languages.",
    "",
    "A situation was built only when every phrase to say, every reason and every point of conduct in it is an exact excerpt of a stored source: a HadeethEnc hadith (stored in `content/fetched/hadith/`, with its grade), a QuranEnc verse (`content/fetched/quran/`), or an approved book by textRef (`content/fetched/books/`). The story frame, the other person's ordinary lines, the framing of replies and the check questions are the team's wording, labelled «صياغة فريق رحلة» / \"Wording by the Rehla team\" on screen, and a test fails if any of them repeats five words of a verse or hadith.",
    "",
    f"**Situations shipped: {len(SITUATIONS)}.**",
    "",
]
for path in SITUATIONS:
    situation = json.loads(path.read_text(encoding="utf-8"))
    items = {item["id"]: item for item in situation["items"]}
    lines += [f"## {situation['order']}. {situation['title']['en']} · {situation['title']['ar']}", "", "| Where | Statement (en) | Statement (ar) | Reference |", "|---|---|---|---|"]
    seen: set[tuple[str, str]] = set()

    def row(where: str, quote: dict) -> None:
        key = (quote["ref"], quote["en"])
        if key in seen:
            return
        seen.add(key)
        lines.append(f"| {where} | {cell(quote['en'])} | {cell(quote['ar'])} | {reference(items[quote['ref']])} |")

    for part in ("say", "why", "when"):
        for quote in situation["learn"][part]:
            row(f"learn: {part}", quote)
    for exchange in situation["exchanges"]:
        for point in exchange["keyPoints"]:
            row(f"{exchange['id']} key point", point["quote"])
    for check in situation["check"]:
        for option in check["options"]:
            if option.get("correct") and "quote" in option:
                row(f"check {check['id']}", option["quote"])
    related = ", ".join(situation["relatedLessons"]) or "none"
    lines += ["", f"Related lessons: {related}.", ""]

lines += ["## Candidates dropped", "", "| Candidate | Why |", "|---|---|"]
lines += [f"| {name} | {why} |" for name, why in DROPPED]
lines.append("")
(ROOT / "docs" / "MAWQIF_COVERAGE.md").write_text("\n".join(lines), encoding="utf-8", newline="\n")
print(f"docs/MAWQIF_COVERAGE.md: {len(SITUATIONS)} situations")
