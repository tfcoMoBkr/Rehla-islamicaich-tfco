"""The organisers' glossary (page 7 of the challenge's scholarly package): ten concepts, each with
its approved English equivalent and its usage rule, exactly as the package gives them.

It is used in two ways, both in code:
- "Translate this term" is answered from it, not by a model: the approved equivalent, the usage
  rule, and TerminologyEnc's own definition of the term when the corpus has it, each verbatim.
- An answer that is not in Arabic names a concept in its approved form. TerminologyEnc's English
  names for a concept (its title, and the name its explanation gives the term, as in
  '"Tawhīd" (monotheism)') are the other renderings. Where the answer uses one of them and no
  approved form, the approved form is put in its place.
"""

import json
import re
from dataclasses import dataclass, field
from pathlib import Path

from app.index import Chunk, Index
from app.languages import Language
from app.rafiq.draft import Unit
from app.text import tokens, words

GLOSSARY_FILE = "glossary-p7.json"
# '"Tawhīd" (monotheism)': the name an entry gives a term.
NAMED = re.compile(r"\"([^\"]{2,30})\"\s*\(([^)]{2,40})\)")


@dataclass(frozen=True)
class Definition:
    text: str
    language: Language
    url: str
    reference: str


@dataclass(frozen=True)
class Concept:
    term: str
    approved: str
    rule: str
    renderings: tuple[str, ...] = ()
    definitions: dict[str, Definition] = field(default_factory=dict)

    @property
    def forms(self) -> list[str]:
        """The approved alternatives: "Tawhid / Oneness of God" is two."""
        return [form.strip() for form in self.approved.split("/") if form.strip()]


def _stem(term: str) -> str:
    return "".join(tokens(term))


def _contains(text: list[str], phrase: list[str]) -> bool:
    return bool(phrase) and any(
        text[start : start + len(phrase)] == phrase for start in range(len(text) - len(phrase) + 1)
    )


def _replaced(
    units: list[Unit], name: str, phrase: str, *, first_only: bool = False
) -> tuple[list[Unit], int]:
    """The units with `name` (as a whole word or words) written as `phrase`."""
    pattern = re.compile(r"\b" + r"\s+".join(map(re.escape, name.split())) + r"\b", re.IGNORECASE)
    done = 0
    result: list[Unit] = []
    for unit in units:
        sentences = []
        for sentence in unit.sentences:
            if not (first_only and done):
                sentence, count = pattern.subn(phrase, sentence, count=1 if first_only else 0)
                done += count
            sentences.append(sentence)
        result.append(Unit(unit.kind, sentences, unit.prefix, unit.block, unit.role))
    return result, done


def _definitions(chunks: list[Chunk]) -> dict[str, Definition]:
    return {
        chunk.lang: Definition(
            str(chunk.extra.get("definition") or ""), chunk.lang, chunk.url, chunk.reference
        )
        for chunk in chunks
        if chunk.extra.get("definition")
    }


def _renderings(chunks: list[Chunk], forms: list[str]) -> tuple[str, ...]:
    """TerminologyEnc's English names for the term that are not an approved form."""
    names: list[str] = []
    for chunk in chunks:
        if chunk.lang != "en":
            continue
        names.extend(part.strip() for part in chunk.title.split("/"))
        # The first name an entry gives is its own term's; later ones name others ("ishrāk").
        named = NAMED.search(chunk.text)
        if named:
            names.append(named.group(2).strip())
    approved = [words(form) for form in forms]
    found: dict[str, str] = {}
    for name in names:
        if name and words(name) not in approved:
            found.setdefault(" ".join(words(name)), name)
    return tuple(found.values())


SOURCE_ID = "organisers-glossary"
# The package has no public address: the card links only its entry on the sources page.
SOURCE_URL = ""


class Glossary:
    def __init__(self, concepts: list[Concept], titles: dict[str, str] | None = None) -> None:
        self.concepts = concepts
        # The glossary's title, in Arabic and English.
        self.titles = titles or {}

    @classmethod
    def load(cls, index_dir: Path, index: Index | None = None) -> "Glossary":
        path = index_dir / GLOSSARY_FILE
        data = json.loads(path.read_text(encoding="utf-8")) if path.is_file() else {}
        rows = data.get("terms", [])
        terms: dict[str, list[Chunk]] = {}
        for chunk in index.chunks if index else []:
            if chunk.type == "term":
                terms.setdefault(str(chunk.extra.get("termId")), []).append(chunk)
        concepts = []
        for row in rows:
            forms = [form.strip() for form in row["approved"].split("/") if form.strip()]
            # A TerminologyEnc term is this concept when its Arabic title is the same word.
            chunks = next(
                (
                    group
                    for group in terms.values()
                    if any(c.lang == "ar" and _stem(c.title) == _stem(row["term"]) for c in group)
                ),
                [],
            )
            concepts.append(
                Concept(
                    term=row["term"],
                    approved=row["approved"],
                    rule=row["rule"],
                    renderings=_renderings(chunks, forms),
                    definitions=_definitions(chunks),
                )
            )
        return cls(concepts, data.get("source", {}).get("title"))

    def find(self, *texts: str | None) -> Concept | None:
        """The concept a text names, by its Arabic term or an approved English form."""
        for text in texts:
            if not text:
                continue
            stems, plain = set(tokens(text)), words(text)
            for concept in self.concepts:
                if _stem(concept.term) in stems or any(
                    _contains(plain, words(form)) for form in concept.forms
                ):
                    return concept
        return None

    def named_in(self, text: str) -> list[Concept]:
        """Concepts a text names in Arabic or in English, approved or not."""
        stems, plain = set(tokens(text)), words(text)
        return [
            concept
            for concept in self.concepts
            if _stem(concept.term) in stems
            or any(_contains(plain, words(name)) for name in (*concept.forms, *concept.renderings))
        ]

    def in_approved_form(self, units: list[Unit], language: Language) -> tuple[list[Unit], int]:
        """The answer with each concept in its approved form, and how many names were replaced:
        another rendering ("Monotheism") becomes the approved term, and the concept's first
        mention is its whole approved form ("Tawhid / Oneness of God"). Arabic answers are as
        they are."""
        if language == "ar" or not self.concepts:
            return units, 0
        replaced = 0
        result = units
        for concept in self.concepts:
            for rendering in concept.renderings:
                result, count = _replaced(result, rendering, concept.forms[0])
                replaced += count
            text = " ".join(s for unit in result for s in unit.sentences)
            if concept.approved.lower() in text.lower():
                continue
            named = [form for form in concept.forms if _contains(words(text), words(form))]
            if named:
                result, count = _replaced(result, named[0], concept.approved, first_only=True)
                replaced += count
        return result, replaced

    def rule_for(self, text: str) -> str:
        """The approved forms of the concepts a text names, for the model to use."""
        named = self.named_in(text)
        if not named:
            return ""
        lines = "\n".join(f"- {c.term}: {c.approved}" for c in named)
        return (
            "- These terms have approved English forms in the organisers' glossary. When you name "
            f"one in a language other than Arabic, use its approved form:\n{lines}"
        )
