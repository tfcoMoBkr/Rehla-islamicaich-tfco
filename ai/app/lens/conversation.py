"""Lens as a conversation: the learner and Rafiq look at the photo together and talk about it for as
long as the learner wants (docs/ARCHITECTURE.md, "Lens").

Every turn first applies the decision table (decide.py) to the photo's reading: a photo Lens
declines (a person, a personal document, an unsafe or unclear photo, scripture that matches
nothing) stays declined, and a ruling request keeps the specialist card. Then one small model call
says what the message needs, and code routes it:

- about what can be seen: the vision model looks again, with the question, under the same
  restrictions (nothing about people, no personal document read out, no scripture read or
  explained, no religious statement). The photo is sent only for these turns: the service answers
  `needsImage` and the browser sends the turn again with the photo.
- about meaning, purpose, practice or a ruling: Rafiq, with the photo's subject as context, so
  every Rafiq check, card and relevance gate applies.
- ordinary talk: Rafiq's everyday talk.

A turn may need more than one; the reply is one message. After it come two or three suggested
questions about the photo, questions only. Nothing about the photo or the turn is stored.
"""

import logging
import time
from pathlib import Path

from app.languages import spec, written_in
from app.lens.decide import decide, lookup_text
from app.lens.schemas import Look, Seen, Suggestions, TurnRequest, TurnResponse, TurnRoute
from app.llm import ChatModel, ModelUnavailableError, VisionModel
from app.rafiq.draft import split_sentences
from app.rafiq.graph import Rafiq
from app.rafiq.safety import danger_signs
from app.rafiq.schemas import PageLocale, RafiqAnswer, Turn
from app.rafiq.voice import is_stock
from app.retrieval.retriever import Retriever

log = logging.getLogger("lens")
PROMPTS = Path(__file__).parent / "prompts"
# A photo Lens declines stays declined for every turn about it.
DECLINED_CARDS = frozenset({"person", "unclear", "privacy", "unsafe", "unmatched"})
MAX_SUGGESTIONS = 3
SUGGESTION_WORDS = 14


def _prompt(name: str, **values: str) -> str:
    text = (PROMPTS / f"{name}.md").read_text(encoding="utf-8")
    for key, value in values.items():
        text = text.replace(f"{{{key}}}", value)
    return text


def _history(turns: list[Turn]) -> str:
    if not turns:
        return ""
    return (
        "Earlier in the conversation:\n" + "\n".join(f"{t.role}: {t.text}" for t in turns) + "\n\n"
    )


def photo_context(seen: Seen) -> str:
    """What Rafiq is told about the photo: its subject, and ordinary text read in it (never text
    that looks like scripture, which is only ever shown as its published block)."""
    context = f"(We are looking at a photo of: {seen.subject.strip() or 'something'}"
    if seen.visible_text and not seen.looks_like_scripture and seen.category != "personalDocument":
        context += f". The text in it reads: «{seen.visible_text.text[:300]}»"
    return context + ".)"


def fit_suggestions(questions: list[str], locale: PageLocale, asked: list[str]) -> list[str]:
    """Questions only: each ends as a question, is short, in the page's language, says nothing
    stock, and was not asked already."""
    seen_before = {" ".join(q.split()).casefold() for q in asked}
    kept: list[str] = []
    for question in questions:
        text = " ".join(question.split())
        if not text.endswith(("?", "؟")) or len(split_sentences(text)) != 1:
            continue
        if len(text.split()) > SUGGESTION_WORDS or not written_in(text, locale) or is_stock(text):
            continue
        if text.casefold() in seen_before or text in kept:
            continue
        kept.append(text)
    return kept[:MAX_SUGGESTIONS]


class Conversation:
    def __init__(self, vision: VisionModel, rafiq: Rafiq, retriever: Retriever) -> None:
        self._vision = vision
        self._rafiq = rafiq
        self._retriever = retriever

    @property
    def _chat(self) -> ChatModel:
        return self._rafiq.chat

    async def suggest(self, seen: Seen, locale: PageLocale, turns: list[Turn]) -> list[str]:
        system = _prompt(
            "suggest", subject=seen.subject or "something", language_name=spec(locale).name
        )
        try:
            result = await self._chat.json(
                system, _history(turns) or "(The first look.)", Suggestions
            )
        except Exception:
            return []
        asked = [turn.text for turn in turns if turn.role == "user"]
        return fit_suggestions(result.questions, locale, asked)

    async def _matched(self, seen: Seen, locale: PageLocale) -> bool:
        """Whether text in the photo is a verse or hadith found exactly in the approved sources."""
        text = lookup_text(seen)
        if not text:
            return False
        passage, quote = await self._retriever.find_quoted(text, locale, ("quran", "hadith"))
        return passage is not None and quote is not None and quote.exact

    async def _route(self, request: TurnRequest) -> TurnRoute:
        system = _prompt("route", subject=request.seen.subject or "something")
        try:
            return await self._chat.json(
                system, _history(request.history) + request.question, TurnRoute
            )
        except Exception:
            # Unsure what is asked: Rafiq, whose own checks decide how to answer.
            return TurnRoute(meaning=True)

    async def _look(self, request: TurnRequest, route: TurnRoute, image: str) -> Look:
        system = _prompt("look", language_name=spec(request.locale).name)
        question = route.visual_question or request.question
        try:
            return await self._vision.json(system, question, Look, image=image)
        except ModelUnavailableError:
            return Look()

    async def turn(self, request: TurnRequest, image: str | None) -> TurnResponse:
        started = time.perf_counter()
        seen, locale = request.seen, request.locale
        decision = decide(seen, matched=await self._matched(seen, locale))
        if decision.card in DECLINED_CARDS:
            return TurnResponse(status="declined", card=decision.card)
        context = [Turn(role="user", text=photo_context(seen)), *request.history]
        if decision.specialist or danger_signs(request.question):
            # A ruling request about the paper, or a sign of danger: Rafiq's own path answers it.
            referred = await self._rafiq.run(
                request.question, locale, history=context, scope=request.reached_lesson_ids
            )
            return TurnResponse(status="answered", answer=referred)

        route = await self._route(request)
        visual: str | None = None
        card = None
        if route.visual:
            if image is None:
                return TurnResponse(status="needsImage")
            look = await self._look(request, route, image)
            if look.about_people:
                card = "person"
            elif look.reads_document:
                card = "privacy"
            elif look.answer.strip():
                kept = await self._rafiq.everyday({"visual": look.answer}, locale)
                visual = kept.get("visual")

        answer: RafiqAnswer | None = None
        if route.meaning or route.talk or not route.visual:
            question = route.meaning_question or request.question
            answer = await self._rafiq.run(
                question, locale, history=context, scope=request.reached_lesson_ids
            )
        turns = [*request.history, Turn(role="user", text=request.question)]
        suggestions = await self.suggest(seen, locale, turns)
        log.info(
            "lens turn row=%d visual=%s meaning=%s talk=%s card=%s ms=%d",
            decision.row,
            route.visual,
            route.meaning,
            route.talk,
            card,
            (time.perf_counter() - started) * 1000,
        )
        return TurnResponse(
            status="answered", visual=visual, answer=answer, card=card, suggestions=suggestions
        )
