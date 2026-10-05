"""The learner's name, which Rafiq never sees.

The model may write the placeholder {{name}} in a warm line (an opening, a follow-up, a reply to
small talk); the web app fills it in on the learner's device, or removes it when no name is kept.
Code here keeps the placeholder where a companion would use a name, and nowhere else:

- never in the cited answer;
- never in two replies in a row: a name in every message stops sounding warm.

The same removal rules run in the web app (web/src/lib/rafiq/name.ts).
"""

import re

from app.rafiq.schemas import Turn

PLACEHOLDER = re.compile(r"\{\{\s*name\s*\}\}", flags=re.IGNORECASE)

# The placeholder with what only makes sense beside a name: an Arabic vocative «يا», and the comma
# that sets the name apart. Longest forms first.
_WITH_PUNCTUATION = [
    # Set off by commas on both sides: both go with it.
    re.compile(r"[،,]\s*(?:يا\s*)?\{\{\s*name\s*\}\}\s*[،,]", flags=re.IGNORECASE),
    re.compile(r"[،,]\s*يا\s*\{\{\s*name\s*\}\}", flags=re.IGNORECASE),
    re.compile(r"يا\s*\{\{\s*name\s*\}\}\s*[،,]?", flags=re.IGNORECASE),
    re.compile(r"[،,]\s*\{\{\s*name\s*\}\}", flags=re.IGNORECASE),
    re.compile(r"\{\{\s*name\s*\}\}\s*[،,]?", flags=re.IGNORECASE),
]


def has_name(text: str | None) -> bool:
    return bool(text) and PLACEHOLDER.search(text or "") is not None


def without_name(text: str) -> str:
    """The text with the placeholder, and the vocative or comma around it, removed cleanly."""
    if not has_name(text):
        return text
    for pattern in _WITH_PUNCTUATION:
        text = pattern.sub("", text)
    text = re.sub(r"\s+([.!?؟،,۔।])", r"\1", text)
    text = re.sub(r"\s{2,}", " ", text).strip()
    text = re.sub(r"^[،,.\s]+", "", text)
    # A sentence that began with the name now begins with the next word.
    text = re.sub(
        r"(^|[.!?]\s+)([a-z])", lambda match: match.group(1) + match.group(2).upper(), text
    )
    return text


def named_last_time(history: list[Turn] | None) -> bool:
    """Whether Rafiq's previous reply in this conversation used the name."""
    replies = [turn.text for turn in history or [] if turn.role == "assistant"]
    return bool(replies) and has_name(replies[-1])
