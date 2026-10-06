"""The reliability policy of CLAUDE.md as code. Prompts describe it; these functions enforce it.

| Level | Behaviour |
| A | direct answer with sources |
| B | answer from approved material, references shown |
| C | restricted answer saying scholars differ, or referral |
| D | no ruling: general information only, and referral |

A personal case is treated like level D whatever level the classifier gave it. Distress is met
with care and, always, the specialist card; danger never reaches generation (see safety.py).

A message is routed by its parts: conversation is the default. One that needs no religious
knowledge (a feeling, a plan, a general question) is answered as conversation, with no source, and
never ends in a referral; one that does goes through the sources, with its
everyday part answered alongside. A question about whether all scholars agree is treated as a
disputed matter.
"""

from typing import Literal

from app.rafiq.schemas import Classification, Draft, ReferralReason

Route = Literal["retrieve", "talk", "clarify", "danger"]
Mode = Literal["full", "general", "disputed", "distress"]

# Referrals that end with the specialist card (named bodies, chosen city, national channel).
SPECIALIST_REASONS: frozenset[ReferralReason] = frozenset(
    {
        "fatwa",
        "personalCase",
        "disputed",
        "noSource",
        "noEvidence",
        "verification",
        "distress",
        "danger",
        "unexplained",
        "verseNotFound",
        "hadithNotFound",
    }
)


def route(classification: Classification) -> Route:
    if classification.danger:
        return "danger"
    if classification.unclear:
        return "clarify"
    if classification.religious:
        return "retrieve"
    # Everything else is conversation, general questions included: Rafiq talks like a friend.
    return "talk"


def disputed(classification: Classification) -> bool:
    return classification.level == "C" or classification.consensus


def needs_ruling_guard(classification: Classification) -> bool:
    return classification.level == "D" or classification.personal_case


def mode(classification: Classification) -> Mode:
    if needs_ruling_guard(classification):
        return "general"
    if classification.intent == "distress":
        return "distress"
    if disputed(classification):
        return "disputed"
    return "full"


def referral_after_answer(classification: Classification) -> ReferralReason | None:
    """A level D question, a personal case, distress or a disputed matter is always referred, even
    when the passages allow sourced general information: the specialist card follows the answer."""
    # A personal case is named as such even when it also asks for a ruling: the learner hears
    # that this is about their own situation, which a specialist can listen to.
    if classification.personal_case:
        return "personalCase"
    if classification.level == "D":
        return "fatwa"
    if classification.intent == "distress":
        return "distress"
    if disputed(classification):
        return "disputed"
    return None


def referral_after_failed_check(classification: Classification) -> ReferralReason:
    """Why a draft with nothing verified left is referred. A guarded question keeps its own reason:
    the ruling guard removing every sentence is the policy working, not a failed answer."""
    if needs_ruling_guard(classification) or classification.intent == "distress":
        return referral_after_answer(classification) or "verification"
    return "verification"


def referral_without_answer(
    classification: Classification, draft: Draft | None
) -> ReferralReason | None:
    """Why no answer can be given from the passages, or None when the draft may go on to verify."""
    if classification.asks_for_evidence and (draft is None or draft.evidence_found is not True):
        return "noEvidence"
    if draft is None or not draft.adequate or not draft.answer.strip():
        if needs_ruling_guard(classification) or classification.intent == "distress":
            return referral_after_answer(classification)
        return "disputed" if disputed(classification) else "noSource"
    return None
