"""Rafiq's voice, enforced in code on every everyday line (opening, talk, encouragement, next step,
a reply to small talk). Prompts ask for it; these rules make it hold whatever the model writes.

- No stock framing: praise or framing of the question ("great question", «سؤالك عن … مهم»,
  "it's natural to wonder") and the standard closing question ("Is this clear?",
  «هل كان هذا واضحًا لك؟»). A sentence that is one of these is dropped; the rest of its line stays.
- No phrasing repeated from his earlier replies in the conversation (repeats.py): a reply may not
  open as an earlier reply opened, a sentence may not repeat a run of words already said, and the
  closing may not repeat the previous reply's closing. Only the repeated sentences are dropped.
- No greeting returned that was not given: «وعليكم السلام» only answers «السلام عليكم».
- The name now and then: the reply uses {{name}} on every third turn, never twice in a row. When
  it is due and the model did not write it, code adds it to one line; when it is not due, it is
  removed. The web app fills it in on the device, or removes it when no name is kept.
"""

import re

from app.languages import Language
from app.rafiq.draft import split_sentences
from app.rafiq.name import has_name, named_last_time, without_name
from app.rafiq.repeats import same_opening, shared_run
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
    # The learner's feeling named back to them ("I understand you feel nervous").
    r"(?:أتفهم|أفهم|أدرك|أقدر|أقدّر)\s+(?:تمامًا\s+|تماما\s+)?(?:شعورك|مشاعرك|قلقك|توترك|خوفك|حزنك|أنك)"
    r"|يبدو\s+(?:أنك|انك)\s+(?:تشعر|متوتر|قلق|حزين|خائف|متعب)",
    r"\bi\s+(?:can\s+)?(?:understand|see|hear)\s+(?:that\s+|how\s+)?(?:you(?:'re|\s+are|\s+feel)|your\s+(?:feeling|worry|nerves|stress))",
    r"\bit\s+sounds\s+like\s+you(?:'re|\s+are)?\b",
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
    plain = TASHKEEL.sub("", sentence)
    return any(pattern.search(sentence) or pattern.search(plain) for pattern in STOCK)


# The learner addressed in the feminine: vowelled («أنكِ»، «بدأتِ») or by its form («تشعرين»،
# «لا تقلقي»، «تفضلي»). The site addresses the learner in the masculine.
FEMININE = re.compile(
    r"[\u0643\u062a]\u0650(?![\u0621-\u064a])"
    r"|(?<![\u0621-\u064a])ت(?!مرين|كوين|عيين|حسين|زيين|أمين|دوين|لوين|خزين|مكين|بيين)"
    r"[\u0621-\u064a]{2,6}ين(?![\u0621-\u064a])"
    r"|(?:لا|ألا)\s+ت[\u0621-\u064a]{2,6}ي(?![\u0621-\u064a])|تفضلي|(?<![\u0621-\u064a])أنتِ"
)
TASHKEEL = re.compile(r"[\u064b-\u065f\u0670]")


def feminine(line: str) -> bool:
    """Whether an Arabic line addresses the learner in the feminine."""
    return bool(FEMININE.search(line) or FEMININE.search(TASHKEEL.sub("", line)))


def without_stock(line: str) -> str:
    """The line without its stock sentences."""
    kept = [sentence for sentence in split_sentences(line) if not is_stock(sentence)]
    return " ".join(kept).strip()


def _key(text: str, last: bool) -> tuple[str, ...]:
    found = words(without_name(text))
    return tuple(found[-SAME_WORDS:] if last else found[:SAME_WORDS])


GIVEN_GREETING = re.compile(
    r"السلام\s*عليكم|سلام\s*عليكم|\bas+[-\s]?salam|\bsalam\b|\bsalaam\b|peace be upon you",
    re.IGNORECASE,
)
RETURNED_GREETING = re.compile(
    r"وعليكم\s*السلام|\bwa\s*['‘’]?\s*ala[iy]?kum"
    r"|\b(?:and\s+)?(?:peace|upon you)\b[^.!?]{0,20}\b(?:too|as well)\b",
    re.IGNORECASE,
)


def _earlier(history: list[Turn] | None) -> list[str]:
    return [turn.text for turn in history or [] if turn.role == "assistant"]


def _first_sentence(text: str) -> str:
    lines = [line for line in text.splitlines() if line.strip()]
    sentences = split_sentences(lines[0]) if lines else []
    return sentences[0] if sentences else ""


def fresh(line: str, history: list[Turn] | None, *, opens: bool, asked: str = "") -> str:
    """The line without the sentences that repeat earlier replies, and without a greeting returned
    when none was given. `opens` marks the line that opens the reply."""
    earlier = _earlier(history)
    openings = [first for text in earlier if (first := _first_sentence(text))]
    kept: list[str] = []
    for index, whole in enumerate(split_sentences(line)):
        sentence = whole
        if (greeting := RETURNED_GREETING.search(whole)) and not GIVEN_GREETING.search(asked):
            # The greeting up to the punctuation that closes it; the rest of the sentence stays.
            rest = re.split(r"[.!?؟،,]", whole[greeting.end() :], maxsplit=1)
            sentence = rest[1].strip() if len(rest) > 1 else ""
            if not sentence:
                continue
        if opens and index == 0 and any(same_opening(sentence, first) for first in openings):
            continue
        if shared_run(sentence, earlier):
            continue
        kept.append(sentence)
    return " ".join(kept).strip()


def _previous_reply(history: list[Turn] | None) -> list[str]:
    replies = [turn.text for turn in history or [] if turn.role == "assistant"]
    return [line for line in replies[-1].splitlines() if line.strip()] if replies else []


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
    asked: str = "",
) -> dict[str, str]:
    """The lines with stock framing removed, a repeated opening or closing dropped, and the name
    where it is due. `opening` and `closing` name the lines that open and close the reply."""
    kept: dict[str, str] = {}
    for field, text in lines.items():
        line = without_formulas(without_stock(text or ""))
        if language != "ar":
            # «يا» / "ya" belongs before a name only in Arabic.
            line = FOREIGN_VOCATIVE.sub(r"\1", line)
        else:
            # Addressed in the masculine: a sentence in the feminine goes (the reply is asked
            # for again when nothing is left).
            line = " ".join(s for s in split_sentences(line) if not feminine(s))
        line = fresh(line, history, opens=field == opening, asked=asked)
        if not line:
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
