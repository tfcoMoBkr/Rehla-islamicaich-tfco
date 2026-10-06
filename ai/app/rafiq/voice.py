"""Rafiq's voice, enforced in code on every everyday line (opening, talk, encouragement, next step,
a reply to small talk). Prompts ask for it; these rules make it hold whatever the model writes.

- No stock framing: praise or framing of the question ("great question", «سؤالك عن … مهم»,
  "it's natural to wonder") and the standard closing question ("Is this clear?",
  «هل كان هذا واضحًا لك؟»). A sentence that is one of these is dropped; the rest of its line stays.
- No fixed opening or closing: a reply may not open as the previous reply opened, nor close as it
  closed. The first sentence is compared with the previous reply's first line, the last with its
  last line.
- The name now and then: the reply uses {{name}} on every third turn, never twice in a row. When
  it is due and the model did not write it, code adds it to one line; when it is not due, it is
  removed. The web app fills it in on the device, or removes it when no name is kept.
"""

import re

from app.languages import Language
from app.rafiq.draft import split_sentences
from app.rafiq.name import has_name, named_last_time, without_name
from app.rafiq.schemas import Turn
from app.text import words

# Patterns of stock framing, in the languages Rafiq writes everyday lines in. They describe a
# style, not a topic: none of them names anything about Islam.
_STOCK = [
    # Praise or framing of the question.
    r"سؤال\w*[^.؟!،]{0,60}\b(?:مهم|مهمّ|جيد|جيّد|رائع|ممتاز|وجيه|في محله|في محلّه|جميل)",
    r"من\s+(?:الطبيعي|الجيد|الجيّد|الرائع|الجميل|المفهوم)\s+أن",
    r"\bأحسنت\s+(?:السؤال|بسؤالك)",
    r"شكر\w*\s+(?:لك\s+)?على\s+(?:هذا\s+)?سؤال",
    r"أفهم\s+(?:لماذا|سبب|رغبتك|حرصك)",
    r"\b(?:great|good|excellent|important|wonderful|thoughtful|interesting|fair|valid)\s+question\b",
    r"\bit(?:'s| is)\s+(?:natural|normal|understandable|good|great|wonderful)\s+(?:to|that)\b",
    r"\b(?:i'?m|i am)\s+glad\s+you\s+(?:asked|are asking)\b",
    r"\bthank(?:s| you)\s+for\s+(?:asking|your question|this question)\b",
    r"\bit is good that you\b",
    r"\b(?:a|an)\s+(?:good|great|important|fair)\s+thing\s+to\s+(?:ask|wonder)\b",
    r"\bi (?:can )?understand why you\b",
    # The standard closing question.
    r"هل\s+(?:كان(?:ت)?\s+)?(?:هذه\s+الإجابة|هذا\s+الشرح|الشرح|هذا|الجواب|الإجابة)[^؟]{0,20}واضح",
    r"(?:أتمنى|آمل|أرجو)\s+أن\s+(?:يكون|تكون)\s+[^.؟!]{0,30}(?:واضح|مفيد|نافع)",
    r"\b(?:does|did)\s+(?:this|that)\s+(?:explanation\s+|answer\s+)?"
    r"(?:make sense|help|answer your question)\b",
    r"\b(?:is|was)\s+(?:this|that|it)\s+(?:answer\s+|explanation\s+)?(?:clear|helpful)\b",
    r"\bi\s+hope\s+(?:this|that|it)\s+(?:helps|is clear|was helpful|makes sense)\b",
]
STOCK = [re.compile(pattern, flags=re.IGNORECASE) for pattern in _STOCK]
# Two lines open (or close) alike when their first (last) words match this far.
SAME_WORDS = 4
# Every third reply uses the name, never two in a row.
NAME_EVERY = 3
FOREIGN_VOCATIVE = re.compile(r"(?:\b[Yy]a|يا)\s*(\{\{\s*name\s*\}\})")


def is_stock(sentence: str) -> bool:
    return any(pattern.search(sentence) for pattern in STOCK)


def without_stock(line: str) -> str:
    """The line without its stock sentences."""
    kept = [sentence for sentence in split_sentences(line) if not is_stock(sentence)]
    return " ".join(kept).strip()


def _key(text: str, last: bool) -> tuple[str, ...]:
    found = words(without_name(text))
    return tuple(found[-SAME_WORDS:] if last else found[:SAME_WORDS])


def _previous_reply(history: list[Turn] | None) -> list[str]:
    replies = [turn.text for turn in history or [] if turn.role == "assistant"]
    return [line for line in replies[-1].splitlines() if line.strip()] if replies else []


def repeats_opening(line: str, history: list[Turn] | None) -> bool:
    previous = _previous_reply(history)
    sentences = split_sentences(line)
    if not previous or not sentences:
        return False
    first = split_sentences(previous[0])
    return bool(first) and _key(sentences[0], False) == _key(first[0], False)


def repeats_closing(line: str, history: list[Turn] | None) -> bool:
    previous = _previous_reply(history)
    sentences = split_sentences(line)
    if not previous or not sentences:
        return False
    last = split_sentences(previous[-1])
    return bool(last) and _key(sentences[-1], True) == _key(last[-1], True)


def name_due(history: list[Turn] | None) -> bool:
    """Whether this reply addresses the learner by name: every third turn, never twice in a row."""
    replies = [turn for turn in history or [] if turn.role == "assistant"]
    return not named_last_time(history) and len(replies) % NAME_EVERY == 0


def _with_name(line: str, language: Language) -> str:
    if language == "ar":
        return f"يا {{{{name}}}}، {line}"
    body = line.rstrip()
    end = body[-1] if body and body[-1] in ".?!" else ""
    return f"{body[: len(body) - len(end)]}, {{{{name}}}}{end or '.'}"


# Religious formulas in an everyday line, beyond returning a greeting: removed, since in a reply
# of Rafiq's they read as a religious statement.
FORMULA = re.compile(
    r"[،,]?\s*(?:و\s*)?(?:الحمد\s*لله|إن\s*شاء\s*الله|ما\s*شاء\s*الله|سبحان\s*الله|بارك\s*الله(?:\s*فيك)?|جزاك\s*الله\s*خيرً?ا?)"
    r"|,?\s*\b(?:alhamdulillah|al-hamdu\s*lillah|in\s*sha'?\s*allah|insha'?\s*allah"
    r"|masha'?\s*allah|subhan\s*allah|barak\s*allahu?\s*fik)\b",
    re.IGNORECASE,
)


def without_formulas(line: str) -> str:
    """The line without religious formulas, its punctuation tidied."""
    return re.sub(r"\s+([.!?؟،,])", r"\1", FORMULA.sub("", line)).strip()


def voiced(
    lines: dict[str, str],
    history: list[Turn] | None,
    language: Language,
    *,
    opening: str = "opening",
    closing: str = "followUp",
    name_order: tuple[str, ...] = ("encouragement", "talk", "opening", "followUp"),
) -> dict[str, str]:
    """The lines with stock framing removed, a repeated opening or closing dropped, and the name
    where it is due. `opening` and `closing` name the lines that open and close the reply."""
    kept: dict[str, str] = {}
    for field, text in lines.items():
        line = without_formulas(without_stock(text or ""))
        if language != "ar":
            # «يا» / "ya" belongs before a name only in Arabic.
            line = FOREIGN_VOCATIVE.sub(r"\1", line)
        if not line:
            continue
        if field == opening and repeats_opening(line, history):
            continue
        if field == closing and repeats_closing(line, history):
            continue
        kept[field] = line
    if not name_due(history):
        return {field: without_name(line) for field, line in kept.items()}
    named = [field for field, line in kept.items() if has_name(line)]
    for field in named[1:]:
        kept[field] = without_name(kept[field])
    if not named:
        target = next((field for field in name_order if field in kept), None)
        if target:
            kept[target] = _with_name(kept[target], language)
    return kept
