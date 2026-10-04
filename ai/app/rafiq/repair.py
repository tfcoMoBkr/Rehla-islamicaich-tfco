"""Deterministic repairs of a parsed draft, and the finishing every answer gets before it is shown.

`repair` runs only when the model's retry still has problems. It never adds words, only removes or
replaces, so whatever is left was written against the passages and is checked again:
- a sentence with no marker, an unknown marker, Quran brackets or no support is removed;
- a placeholder that points to nothing is removed;
- a sentence that copies a verse or hadith is replaced by that passage's block, placed once.
It refers (returns None) when nothing cited, neither a sentence nor a block, is left.

`finish` runs on every answer: a verse or hadith the answer relies on is shown as its block, the
misquoted verse is shown, at most MAX_BLOCKS blocks are kept (the most relevant first), and an
extractive answer keeps at most EXTRACTIVE_SENTENCES sentences of its own.
"""

from app.languages import Language
from app.rafiq.check import Problem, cited, code_problems, find_passage, is_lead_in
from app.rafiq.draft import Unit, markers
from app.retrieval.passages import Passage

MAX_BLOCKS = 2
EXTRACTIVE_SENTENCES = 2
REPAIR_ROUNDS = 3
REMOVED_WITH_SENTENCE = {
    "unmarked",
    "unknownMarker",
    "verseBrackets",
    "unsupported",
    "wrongLanguage",
}


def block_of(passage: Passage) -> tuple[str, str] | None:
    if passage.verse:
        return "quran", passage.verse.ref
    if passage.hadith:
        return "hadith", str(passage.hadith.id)
    return None


def _end_of_group(units: list[Unit], index: int) -> int:
    """The last unit of the list an item belongs to (a block never splits a list)."""
    while (
        units[index].kind == "item" and index + 1 < len(units) and units[index + 1].kind == "item"
    ):
        index += 1
    return index


def materialize(units: list[Unit], known: set[int]) -> list[Unit]:
    """Writes each sentence's covering markers onto it, so removing one sentence of a paragraph
    never leaves the others without their source. Unknown numbers are not copied."""
    result: list[Unit] = []
    for unit in units:
        sentences = []
        for s, sentence in enumerate(unit.sentences):
            numbers = [n for n in unit.covering(s) if n in known]
            if numbers and not markers(sentence):
                sentence = _with_markers(sentence, numbers)
            sentences.append(sentence)
        result.append(Unit(unit.kind, sentences, unit.prefix, unit.block))
    return result


def _with_markers(sentence: str, numbers: list[int]) -> str:
    tags = "".join(f"[{n}]" for n in numbers)
    body = sentence.rstrip()
    end = len(body)
    while end and body[end - 1] in ".!?؟۔।":
        end -= 1
    return f"{body[:end]} {tags}{body[end:]}"


def tidy(units: list[Unit]) -> list[Unit]:
    """Drops empty paragraphs and items, repeated blocks, and lead-ins left with nothing to lead."""
    kept: list[Unit] = []
    shown: set[tuple[str, str]] = set()
    for unit in units:
        if unit.kind == "block":
            if unit.block and unit.block not in shown:
                shown.add(unit.block)
                kept.append(unit)
        elif unit.sentences:
            kept.append(Unit(unit.kind, list(unit.sentences), unit.prefix))
    for index, unit in enumerate(kept):
        following = kept[index + 1] if index + 1 < len(kept) else None
        leads = following is not None and following.kind in ("block", "item")
        if unit.kind != "block" and unit.sentences[-1].rstrip().endswith((":", "：")) and not leads:
            unit.sentences.pop()
    return [unit for unit in kept if unit.kind == "block" or unit.sentences]


def _apply(units: list[Unit], problems: list[Problem], passages: list[Passage]) -> list[Unit]:
    by_number = {passage.n: passage for passage in passages}
    removed: set[tuple[int, int]] = set()
    dropped: set[int] = set()
    insert_after: dict[int, list[tuple[str, str]]] = {}
    shown = {unit.block for unit in units if unit.kind == "block"}
    for problem in problems:
        if problem.unit is None:
            continue
        if problem.kind == "unknownBlock":
            dropped.add(problem.unit)
        elif problem.kind in REMOVED_WITH_SENTENCE and problem.sentence is not None:
            removed.add((problem.unit, problem.sentence))
        elif problem.kind == "copiedSacred" and problem.sentence is not None:
            removed.add((problem.unit, problem.sentence))
            passage = by_number.get(problem.passage or 0)
            block = block_of(passage) if passage else None
            if block and block not in shown:
                shown.add(block)
                insert_after.setdefault(_end_of_group(units, problem.unit), []).append(block)
    repaired: list[Unit] = []
    for u, unit in enumerate(units):
        if u not in dropped:
            sentences = [s for i, s in enumerate(unit.sentences) if (u, i) not in removed]
            repaired.append(Unit(unit.kind, sentences, unit.prefix, unit.block))
        for block in insert_after.get(u, []):
            repaired.append(Unit("block", block=block))
    return tidy(repaired)


def repair(
    units: list[Unit],
    problems: list[Problem],
    passages: list[Passage],
    required_verse: str | None = None,
    language: Language | None = None,
) -> list[Unit] | None:
    """The draft with every repairable problem repaired, or None if it cannot stand."""
    # Writing the markers out keeps every sentence in place, so the model check's verdicts still
    # point at the right sentences; the code checks are run again on the result.
    current = materialize(units, {passage.n for passage in passages})
    verdicts = [p for p in problems if p.kind == "unsupported"]
    problems = verdicts + code_problems(current, passages, required_verse, language)
    for _ in range(REPAIR_ROUNDS):
        actionable = [p for p in problems if p.kind != "missingVerse"]
        if not actionable:
            break
        current = _apply(current, actionable, passages)
        problems = code_problems(current, passages, required_verse, language)
    remaining = [p for p in problems if p.kind != "missingVerse"]
    # A verse or hadith block is cited content too: it is shown with its source card.
    shows_sacred = any(unit.kind == "block" for unit in current)
    if remaining or not (cited(current) or shows_sacred):
        return None
    return current


def finish(
    units: list[Unit],
    passages: list[Passage],
    *,
    required_verse: str | None = None,
    extractive: bool = False,
) -> list[Unit]:
    by_number = {passage.n: passage for passage in passages}
    result = materialize(units, set(by_number))
    if extractive:
        result = _keep_own_sentences(result, EXTRACTIVE_SENTENCES)
    shown = [unit.block for unit in result if unit.kind == "block"]

    if required_verse and ("quran", required_verse) not in shown:
        first_text = next((i for i, unit in enumerate(result) if unit.kind != "block"), -1)
        result.insert(first_text + 1, Unit("block", block=("quran", required_verse)))
        shown.append(("quran", required_verse))

    # A verse or hadith the answer relies on is shown, after the paragraph that first cites it.
    for u, _, numbers in cited(result):
        for n in numbers:
            passage = by_number.get(n)
            block = block_of(passage) if passage else None
            if block and block not in shown:
                shown.append(block)
                position = _end_of_group(result, u) + 1
                result.insert(position, Unit("block", block=block))
    return tidy(_keep_most_relevant(result, passages, required_verse))


def _relevance(block: tuple[str, str], passages: list[Passage], required: str | None) -> tuple:
    if block == ("quran", required):
        return (0, 0)
    passage = find_passage(passages, *block)
    return (1, passage.n if passage else len(passages) + 1)


def _keep_most_relevant(
    units: list[Unit], passages: list[Passage], required: str | None
) -> list[Unit]:
    """At most MAX_BLOCKS blocks, in their places, the most relevant one read first."""
    positions = [i for i, unit in enumerate(units) if unit.kind == "block" and unit.block]
    blocks = [units[i].block for i in positions]
    ranked = sorted((b for b in blocks if b), key=lambda b: _relevance(b, passages, required))[
        :MAX_BLOCKS
    ]
    kept_positions = [i for i in positions if units[i].block in ranked]
    result: list[Unit] = []
    order = iter(ranked)
    for i, unit in enumerate(units):
        if unit.kind == "block":
            if i in kept_positions:
                result.append(Unit("block", block=next(order)))
            continue
        result.append(unit)
    return result


def _keep_own_sentences(units: list[Unit], limit: int) -> list[Unit]:
    """The first `limit` cited sentences the model wrote; its other sentences are dropped."""
    keep = {(u, s) for u, s, _ in cited(units)[:limit]}
    result: list[Unit] = []
    for u, unit in enumerate(units):
        if unit.kind == "block":
            result.append(unit)
            continue
        sentences = [
            sentence
            for s, sentence in enumerate(unit.sentences)
            if (u, s) in keep or is_lead_in(units, u, s)
        ]
        result.append(Unit(unit.kind, sentences, unit.prefix, unit.block))
    return tidy(result)
