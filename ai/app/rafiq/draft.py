"""A model's draft answer as structure: paragraphs, list items and verse or hadith blocks, each
paragraph or item cut into sentences. Checks and repairs work on this structure, so they hold for
any reasonable writing style and any language.

Markers are read in every form models write them ("[1]", "[1, 2]", "[1][2]", "[2-3]", Arabic,
Persian or Bengali digits) and rewritten as "[1][2]". A marker written after a sentence's full stop
belongs to that sentence.
"""

import re
from dataclasses import dataclass, field
from typing import Literal

# ASCII, Arabic-Indic, Persian and Bengali digits.
DIGIT = r"[0-9\u0660-\u0669\u06f0-\u06f9\u09e6-\u09ef]"
_MARKER_GROUP = re.compile(rf"\[\s*({DIGIT}+(?:\s*(?:[,،;؛\-–]|\s|و)\s*{DIGIT}+)*)\s*\]")
MARKER = re.compile(r"\[(\d+)\]")
PLACEHOLDER = re.compile(
    rf"\{{\{{\s*(?:quran\s*:\s*({DIGIT}+)\s*:\s*({DIGIT}+)|hadith\s*:\s*({DIGIT}+))\s*\}}\}}",
    flags=re.IGNORECASE,
)
_SENTENCE_END = re.compile(r"(?<=[.!?؟۔।])\s+")
_LIST_ITEM = re.compile(rf"^\s*((?:[-*•▪◦]|{DIGIT}+[.)\-]|[a-z][.)])\s+)(.*)$")
_LEADING_MARKERS = re.compile(r"^((?:\s*\[\d+\])+)\s*")

Kind = Literal["paragraph", "item", "block"]


def number(text: str) -> int:
    return int("".join(str(int(char)) for char in text))


def _canonical_group(match: re.Match[str]) -> str:
    numbers: list[int] = []
    for part in re.finditer(rf"({DIGIT}+)(?:\s*[\-–]\s*({DIGIT}+))?", match.group(1)):
        first = number(part.group(1))
        last = number(part.group(2)) if part.group(2) else first
        numbers.extend(range(first, last + 1) if last >= first else [first])
    return "".join(f"[{n}]" for n in dict.fromkeys(numbers))


def canonical_markers(text: str) -> str:
    return _MARKER_GROUP.sub(_canonical_group, text)


def markers(text: str) -> list[int]:
    return [int(found) for found in MARKER.findall(text)]


def strip_markers(text: str) -> str:
    return re.sub(r"\s*\[\d+\]", "", text)


@dataclass
class Unit:
    kind: Kind
    sentences: list[str] = field(default_factory=list)
    prefix: str = ""
    # For a block: ("quran", "2:256") or ("hadith", "3064").
    block: tuple[str, str] | None = None

    @property
    def closing(self) -> list[int]:
        """The markers that close this paragraph or item: they cover its unmarked sentences."""
        return markers(self.sentences[-1]) if self.sentences else []

    def covering(self, index: int) -> list[int]:
        own = markers(self.sentences[index])
        return own or self.closing


def block_reference(match: re.Match[str]) -> tuple[str, str]:
    if match.group(3):
        return "hadith", str(number(match.group(3)))
    return "quran", f"{number(match.group(1))}:{number(match.group(2))}"


def split_sentences(text: str) -> list[str]:
    parts = [part.strip() for part in _SENTENCE_END.split(text) if part.strip()]
    sentences: list[str] = []
    for part in parts:
        leading = _LEADING_MARKERS.match(part)
        if leading and sentences:
            sentences[-1] = f"{sentences[-1]} {leading.group(1).strip()}"
            part = part[leading.end() :]
        if part.strip():
            sentences.append(part.strip())
    return sentences


def parse(answer: str) -> list[Unit]:
    """Blank lines separate paragraphs; lines that follow each other make one (as in Markdown)."""
    units: list[Unit] = []
    pending: list[str] = []

    def close_paragraph() -> None:
        text = " ".join(pending).strip()
        if text:
            units.append(Unit("paragraph", split_sentences(text)))
        pending.clear()

    for line in canonical_markers(answer).splitlines():
        if not line.strip():
            close_paragraph()
            continue
        position = 0
        for match in PLACEHOLDER.finditer(line):
            pending.append(line[position : match.start()])
            close_paragraph()
            units.append(Unit("block", block=block_reference(match)))
            position = match.end()
        rest = line[position:]
        item = _LIST_ITEM.match(rest)
        if item:
            close_paragraph()
            units.append(Unit("item", split_sentences(item.group(2)), prefix=item.group(1).strip()))
        else:
            pending.append(rest)
    close_paragraph()
    return [unit for unit in units if unit.kind == "block" or unit.sentences]


def render(units: list[Unit]) -> str:
    lines: list[str] = []
    previous: Kind | None = None
    for unit in units:
        if unit.kind == "block" and unit.block:
            kind, reference = unit.block
            text = f"{{{{{kind}:{reference}}}}}"
        elif unit.kind == "item":
            text = f"{unit.prefix} {' '.join(unit.sentences)}"
        else:
            text = " ".join(unit.sentences)
        separator = "\n" if previous == "item" and unit.kind == "item" else "\n\n"
        lines.append(text if not lines else f"{separator}{text}")
        previous = unit.kind
    return "".join(lines)
