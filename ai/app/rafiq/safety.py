"""Signs of danger to the learner or to others, checked in code on every message before any model
is asked. A match skips classification and generation: the reply is a fixed message from the web's
message files urging the learner to contact local emergency services or a trusted person now, with
the specialist card. The check errs on the side of safety: a question that only mentions such a
subject also gets the message.

Patterns are written per situation (harming oneself, harming others, being in danger) in every
answer language, against text normalised by app.text.normalize (no tashkeel, one alef form,
lower case, no Latin diacritics).
"""

import re

from app.text import normalize

PATTERNS: dict[str, list[str]] = {
    "harming oneself": [
        r"suicid",
        r"\bkill(ing)? myself\b",
        r"\bend(ing)? my (own )?life\b",
        r"\btake my (own )?life\b",
        r"\b(want|wanna|wish) to die\b",
        r"\b(hurt|harm|cut)(ing)? myself\b",
        r"\bself[- ]?harm",
        r"انتحار",
        r"انتحر",
        r"اقتل نفسي",
        r"انهي حياتي",
        r"اريد ان اموت",
        r"(اوذي|ايذاء) نفسي",
        r"خود ?کشی",
        r"اپنی جان لے",
        r"خود کو نقصان",
        r"مرنا چاہت",
        r"আত্মহত্যা",
        r"নিজেকে মেরে",
        r"নিজের ক্ষতি",
        r"মরে যেতে চাই",
        r"\bme tuer\b",
        r"mettre fin a (mes jours|ma vie)",
        r"envie de mourir",
        r"me faire du mal",
    ],
    "harming others": [
        r"\b(kill|hurt|harm)(ing)? (him|her|them|someone|somebody)\b",
        r"\b(kill|hurt|harm)(ing)? my (wife|husband|child|children|son|daughter|mother|father)\b",
        r"(ساقتل|اقتله|اقتلها|اقتلهم)",
        r"مار ڈال",
        r"قتل کر",
        r"মেরে ফেল",
        r"খুন কর",
        r"tuer (quelqu|mon|ma|mes|le|la)",
    ],
    "being in danger": [
        r"\b(beats|beat|hits|hit|abuses|abused|abusing) me\b",
        r"\bthreaten(s|ed|ing)? to (kill|hurt)",
        r"\b(i am|i'm|im) not safe\b",
        r"يضربني",
        r"يهددني (بالقتل|بالايذاء)",
        r"(لست|لسنا) (ب|في )?امان",
        r"مجھے مار",
        r"আমাকে মার",
        r"me (frappe|bat)\b",
        r"menace de mort",
        r"je ne suis pas en securite",
    ],
}

_COMPILED = {situation: re.compile("|".join(patterns)) for situation, patterns in PATTERNS.items()}


def danger_signs(text: str) -> list[str]:
    """The situations a message shows signs of (empty when none)."""
    folded = normalize(text)
    return [situation for situation, pattern in _COMPILED.items() if pattern.search(folded)]
