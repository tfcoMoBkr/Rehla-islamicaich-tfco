"""Transliterated terms in English questions, matched to their English names.

A learner writes "wudu" where the books write "ablution". The pairs come from the stored
TerminologyEnc entries, whose explanations open with the transliteration and its English name,
as in '"Wudū’" (ablution) is ...'. Nothing here is written by hand."""

import re
import unicodedata

from app.index import Index

PAIR = re.compile(r"\"([^\"]{2,30})\"\s*\(([^)]{2,40})\)")


def fold(text: str) -> str:
    """Lower case without diacritics or apostrophes: "Wudū’" -> "wudu"."""
    decomposed = unicodedata.normalize("NFKD", text.lower())
    return "".join(char for char in decomposed if char.isascii() and char.isalpha())


class TermExpander:
    def __init__(self, index: Index) -> None:
        self.names: dict[str, str] = {}
        for chunk in index.chunks:
            if chunk.type != "term" or chunk.lang != "en":
                continue
            pair = PAIR.search(chunk.text)
            if pair:
                self.names.setdefault(fold(pair.group(1)), pair.group(2).strip())

    def expand(self, question: str) -> str:
        """The question followed by the English name of each transliterated term in it."""
        words = dict.fromkeys(fold(word) for word in question.split())
        names = [
            self.names[word]
            for word in words
            if word in self.names and self.names[word].lower() not in question.lower()
        ]
        return f"{question} ({', '.join(names)})" if names else question
