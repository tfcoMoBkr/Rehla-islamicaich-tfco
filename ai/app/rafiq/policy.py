"""The reliability policy of CLAUDE.md as code. Prompts describe it; these functions enforce it.

| Level | Behaviour |
| A | direct answer with sources |
| B | answer from approved material, references shown |
| C | restricted answer saying scholars differ, or referral |
| D | no ruling: general information only, and referral |

A personal case is treated like level D whatever level the classifier gave it.
"""

from typing import Literal

from app.rafiq.schemas import Classification, Draft, ReferralReason

Route = Literal["retrieve", "smalltalk", "offtopic"]
Mode = Literal["full", "general", "disputed"]


def route(classification: Classification) -> Route:
    if classification.intent == "offtopic":
        return "offtopic"
    if classification.intent == "smalltalk":
        return "smalltalk"
    return "retrieve"


def needs_ruling_guard(classification: Classification) -> bool:
    return classification.level == "D" or classification.personal_case


def mode(classification: Classification) -> Mode:
    if needs_ruling_guard(classification):
        return "general"
    if classification.level == "C":
        return "disputed"
    return "full"


def referral_after_answer(classification: Classification) -> ReferralReason | None:
    """A level D question or a personal case is always referred, even with general information."""
    if classification.level == "D":
        return "fatwa"
    if classification.personal_case:
        return "personalCase"
    return None


def referral_without_answer(
    classification: Classification, draft: Draft | None
) -> ReferralReason | None:
    """Why no answer can be given from the passages, or None when the draft may go on to verify."""
    if classification.asks_for_evidence and (draft is None or draft.evidence_found is not True):
        return "noEvidence"
    if draft is None or not draft.adequate or not draft.answer.strip():
        if needs_ruling_guard(classification):
            return referral_after_answer(classification)
        return "disputed" if classification.level == "C" else "noSource"
    return None
