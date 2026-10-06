"""Lens: a photo of something around the learner, explained from the approved sources.

Three steps, kept apart:

1. SEE: a vision model reports what the photo shows, as strict JSON (`Seen`). It explains nothing.
2. DECIDE: code applies the decision table (decide.py) to that report and to the approved-source
   lookup the rest of Rafiq uses for quoted text (Retriever.find_quoted).
3. EXPLAIN: only for the rows that answer, the subject or a religious term found in the text
   becomes an ordinary question to Rafiq, so every Rafiq check and card applies to the answer.

The image is held in memory for the SEE call only. Logs carry the kind, the row and the timing.
"""

import asyncio
import logging
import time
from pathlib import Path

from app.languages import spec
from app.lens.conversation import Conversation
from app.lens.decide import Decision, decide, lookup_text, matched_text, shown
from app.lens.schemas import LensResponse, Seen, TurnRequest, TurnResponse
from app.llm import ModelUnavailableError, VisionModel
from app.rafiq.compose import compose
from app.rafiq.draft import Unit, split_sentences
from app.rafiq.graph import Rafiq, referral
from app.rafiq.schemas import PageLocale, RafiqAnswer
from app.retrieval.passages import Passage
from app.retrieval.retriever import Retriever
from app.text import shares_run

log = logging.getLogger("lens")
PROMPTS = Path(__file__).parent / "prompts"
# The whole of one photo's journey, from reading it to the explained answer.
TIME_BUDGET = 45.0
# Words in a row that a description may not share with writing that looks like scripture.
SCRIPTURE_RUN = 3

# The questions EXPLAIN asks Rafiq: plain search wording, not religious content.
QUESTIONS: dict[str, dict[PageLocale, str]] = {
    "subject": {
        "ar": "ما {subject}، وما معناه للمسلم؟",
        "en": "What is {subject}, and what does it mean for a Muslim?",
    },
    "term": {"ar": "ما معنى «{term}»؟", "en": "What does “{term}” mean?"},
    "verse": {"ar": "ما معنى قوله تعالى: «{text}»؟", "en": "What does the verse «{text}» mean?"},
}
DECLINED_ROWS = (7, 8, 9, 10)
# A sourced answer that found nothing is left out of the first reply: the description stands.
UNANSWERED = ("noSource", "noEvidence", "verification", "unexplained", "offTopic")


def question_for(decision: Decision, seen: Seen, locale: PageLocale) -> str | None:
    if decision.explain == "subject":
        return QUESTIONS["subject"][locale].format(subject=seen.subject.strip())
    if decision.explain == "term" and decision.term:
        return QUESTIONS["term"][locale].format(term=decision.term)
    return None


def published_block(passage: Passage, locale: PageLocale) -> RafiqAnswer:
    """Rows 4 and 5: the verse or hadith exactly as its source publishes it, with its reference.
    No model writes anything, and the text read from the photo is never translated."""
    numbered = passage.model_copy(update={"n": 1})
    kind, reference = (
        ("quran", numbered.verse.ref) if numbered.verse else ("hadith", str(numbered.hadith.id))  # type: ignore[union-attr]
    )
    return compose([Unit(kind="block", block=(kind, reference))], [numbered], locale, "A")


def ruling_referral(locale: PageLocale) -> RafiqAnswer:
    """Row 14: no ruling on the learner's own situation; the specialist card."""
    return RafiqAnswer(
        language=locale,
        level="D",
        referred=True,
        kind="referral",
        blocks=[],
        sources=[],
        referral=referral("personalCase"),
    )


class Lens:
    def __init__(self, vision: VisionModel, rafiq: Rafiq, retriever: Retriever) -> None:
        self._vision = vision
        self._rafiq = rafiq
        self._retriever = retriever
        self.conversation = Conversation(vision, rafiq, retriever)

    async def see(self, image: str, locale: PageLocale) -> Seen | None:
        """The vision model's report; None when no model returned a valid one (the unclear card)."""
        system = (
            (PROMPTS / "see.md")
            .read_text(encoding="utf-8")
            .replace("{language_name}", spec(locale).name)
        )
        try:
            return await self._vision.json(system, "Report on this photo.", Seen, image=image)
        except ModelUnavailableError:
            return None

    async def _run(
        self, image: str | None, seen: Seen | None, locale: PageLocale, scope: list[str] | None
    ) -> LensResponse:
        if seen is None:
            seen = await self.see(image, locale) if image else None
        if seen is None:
            return LensResponse(seen=None, row=8, card="unclear")

        passage = None
        text = lookup_text(seen)
        if text:
            # Only the exact wording counts: a near match is not the text in the photo.
            passage = await matched_text(self._retriever, text, locale)
        decision = decide(seen, matched=passage is not None)

        answer = None
        if decision.block and passage is not None and passage.verse is not None and text:
            answer = await self._explained_verse(text, passage, locale, scope)
        elif decision.block and passage is not None:
            answer = published_block(passage, locale)
        elif decision.specialist:
            answer = ruling_referral(locale)
        elif question := question_for(decision, seen, locale):
            answer = await self._rafiq.run(question, locale, scope=scope)
            if answer.referral is not None and answer.referral.reason in UNANSWERED:
                answer = None
        others = seen.others if decision.explain else []
        # The first message opens the conversation: what the learner might ask next.
        suggestions = (
            await self.conversation.suggest(seen, locale, [])
            if decision.card is None and not decision.specialist
            else []
        )
        return LensResponse(
            seen=shown(seen, decision),
            row=decision.row,
            answer=answer,
            card=decision.card,
            description=await self._description(seen, decision, locale),
            others=others,
            suggestions=suggestions,
        )

    async def _explained_verse(
        self, text: str, passage: Passage, locale: PageLocale, scope: list[str] | None
    ) -> RafiqAnswer:
        """Row 4: the verse as published, explained by Rafiq's sourced path; the published block
        alone when no explanation passes his checks."""
        question = QUESTIONS["verse"][locale].format(text=text)
        answer = await self._rafiq.run(question, locale, scope=scope)
        if answer.referral is None and any(block.type == "quran" for block in answer.blocks):
            return answer
        return published_block(passage, locale)

    async def _description(self, seen: Seen, decision: Decision, locale: PageLocale) -> str | None:
        """The general description, for every row that is not declined. Writing that looks like
        scripture is never read out in it: a sentence sharing words with that text is dropped."""
        if decision.row in DECLINED_ROWS or not seen.description.strip():
            return None
        sentences = split_sentences(seen.description.strip())
        if seen.looks_like_scripture and seen.visible_text:
            read = seen.visible_text.text
            sentences = [s for s in sentences if not shares_run(s, read, SCRIPTURE_RUN)]
        # Sentence by sentence, so one sentence that fails the checks does not take the rest.
        checked = await asyncio.gather(
            *(self._rafiq.everyday({"visual": sentence}, locale) for sentence in sentences)
        )
        return " ".join(kept["visual"] for kept in checked if "visual" in kept) or None

    async def turn(self, request: TurnRequest, image: str | None) -> TurnResponse:
        """One message in the conversation about the photo, within the same time budget."""
        try:
            return await asyncio.wait_for(self.conversation.turn(request, image), TIME_BUDGET)
        except TimeoutError:
            return TurnResponse(status="answered", card="timeout")

    async def run(
        self,
        locale: PageLocale,
        *,
        image: str | None = None,
        seen: Seen | None = None,
        scope: list[str] | None = None,
    ) -> LensResponse:
        """`image` is a data URL. `seen` skips reading: an example, or a subject chosen."""
        started = time.perf_counter()
        try:
            response = await asyncio.wait_for(self._run(image, seen, locale, scope), TIME_BUDGET)
        except TimeoutError:
            response = LensResponse(seen=None, row=0, card="timeout")
        log.info(
            "lens row=%d kind=%s card=%s ms=%d",
            response.row,
            response.seen.kind if response.seen else None,
            response.card,
            (time.perf_counter() - started) * 1000,
        )
        return response
