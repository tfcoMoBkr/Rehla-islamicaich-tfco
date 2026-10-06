"""Mawqif practice as a real conversation: the AI plays the other person in a fresh scene inside a
situation's theme, the learner writes freely, and each reply is judged against the situation's
key points. Afterwards, feedback on each reply with a better one where it helps.

Guards, in code:
- Every learner reply is checked for danger before any model sees it (safety.py). A model call
  per turn also reports distress, a religious question asked in the middle (the page pauses the
  scene and asks Rafiq), and a ruling asked for the learner's own case (the specialist card).
- The other person speaks ordinary everyday speech only: each line passes Rafiq's everyday-talk
  checks (code, then the model check); a line that fails is asked for once more, then the turn
  falls back to the written choices.
- A suggested better reply is written by the model in ordinary words; any religious words in it are
  the situation's own quotes, inserted by code from {{say:ID}} placeholders. The model's own words
  pass the everyday-talk checks, or the suggestion is not shown.
- 20 seconds per call. Nothing typed is stored or logged: logs carry statuses, counts and timings.
"""

import asyncio
import json
import logging
import re
import time
from pathlib import Path
from typing import Any

from app.languages import spec
from app.llm import ChatModel, ModelUnavailableError
from app.mawqif.schemas import (
    ExplainRequest,
    FeedbackRequest,
    FeedbackResponse,
    Line,
    ModelFeedback,
    ModelTurn,
    ReplyFeedback,
    Scene,
    StartRequest,
    StartResponse,
    TurnRequest,
    TurnResponse,
)
from app.rafiq.graph import NAME_DUE, VOCATIVE, Rafiq
from app.rafiq.safety import danger_signs
from app.rafiq.schemas import PageLocale, RafiqAnswer

log = logging.getLogger("mawqif")
PROMPTS = Path(__file__).parent / "prompts"
TIME_BUDGET = 20.0
SCENE_FIELDS = ("person", "place", "mood", "setting", "line")
SAY = re.compile(r"\{\{\s*say\s*:\s*(s\d+)\s*\}\}", flags=re.IGNORECASE)

Situation = dict[str, Any]
Situations = dict[str, Situation]


def load_situations(path: Path) -> Situations:
    data: Situations = json.loads(path.read_text(encoding="utf-8"))
    return data


def _prompt(name: str, **values: str) -> str:
    text = (PROMPTS / f"{name}.md").read_text(encoding="utf-8")
    for key, value in values.items():
        text = text.replace(f"{{{key}}}", value)
    return text


def _points(situation: Situation, locale: PageLocale) -> str:
    return "\n".join(f"{point['id']}: {point[locale]}" for point in situation["keyPoints"])


def _conversation(history: list[Line]) -> str:
    who = {"learner": "Learner", "character": "Them"}
    return "\n".join(
        f"{who[line.role]}: <<<{line.text}>>>"
        if line.role == "learner"
        else f"{who[line.role]}: {line.text}"
        for line in history
    )


def fill_says(text: str, situation: Situation, locale: PageLocale) -> tuple[str, str] | None:
    """The better reply with its placeholders filled from the situation's words to say, and its
    own words alone (for the checks). None when it names words the situation does not have."""
    says = {say["id"]: say[locale] for say in situation["say"]}
    if any(match.group(1) not in says for match in SAY.finditer(text)):
        return None
    filled = SAY.sub(lambda match: f"«{says[match.group(1)]}»", text)
    own = re.sub(r"\s{2,}", " ", SAY.sub(" ", text)).strip()
    return filled, own


class Practice:
    def __init__(self, chat: ChatModel, rafiq: Rafiq, situations: Situations) -> None:
        self._chat = chat
        self._rafiq = rafiq
        self._situations = situations

    async def _everyday(self, lines: dict[str, str], locale: PageLocale) -> dict[str, str]:
        return await self._rafiq.everyday(lines, locale)

    async def start(self, body: StartRequest) -> StartResponse:
        situation = self._situations.get(body.situation_id)
        if situation is None:
            return StartResponse(status="unknownSituation")
        locale = body.locale
        system = _prompt(
            "scene",
            title=situation["title"][locale],
            scene=situation["scene"][locale],
            character=situation["character"][locale],
            avoid="; ".join(body.avoid) or "none yet",
            language_name=spec(locale).name,
        )
        # A field that fails its checks on the last try is replaced by the situation's own
        # (team-written) character and scene, or left out; only the first line is required.
        fallback = {"person": situation["character"][locale], "setting": situation["scene"][locale]}
        user = "Set the scene."
        started = time.perf_counter()
        try:
            async with asyncio.timeout(TIME_BUDGET):
                for attempt in range(2):
                    scene = await self._chat.json(system, user, Scene)
                    written = {
                        field: text
                        for field in SCENE_FIELDS
                        if (text := getattr(scene, field)).strip()
                    }
                    kept = await self._everyday(written, locale)
                    failed = [field for field in written if field not in kept]
                    if "line" in kept and (not failed or attempt == 1):
                        scene = Scene.model_validate(
                            {**{f: fallback.get(f, "") for f in failed}, **kept}
                        )
                        log.info("mawqif scene ready ms=%d", (time.perf_counter() - started) * 1000)
                        return StartResponse(status="ready", scene=scene)
                    user += (
                        f"\n\n(These fields of your last scene were not ordinary everyday speech in"
                        f" {spec(locale).name}: {', '.join(failed)}. Write every field in"
                        f" {spec(locale).name}.)"
                    )
        except (TimeoutError, ModelUnavailableError):
            pass
        log.info("mawqif scene unavailable ms=%d", (time.perf_counter() - started) * 1000)
        return StartResponse(status="unavailable")

    async def turn(self, body: TurnRequest) -> TurnResponse:
        started = time.perf_counter()
        situation = self._situations.get(body.situation_id)
        if situation is None:
            response = TurnResponse(status="unknownSituation")
        elif danger_signs(body.reply):
            response = TurnResponse(status="danger")
        else:
            try:
                response = await asyncio.wait_for(self._turn(body, situation), TIME_BUDGET)
            except (TimeoutError, ModelUnavailableError):
                response = TurnResponse(status="unavailable")
        log.info(
            "mawqif turn status=%s met=%d ms=%d",
            response.status,
            len(response.met),
            (time.perf_counter() - started) * 1000,
        )
        return response

    async def _turn(self, body: TurnRequest, situation: Situation) -> TurnResponse:
        locale, scene = body.locale, body.scene
        system = _prompt(
            "turn",
            person=scene.person or situation["character"][locale],
            title=situation["title"][locale],
            setting=scene.setting or situation["scene"][locale],
            language_name=spec(locale).name,
            points=_points(situation, locale),
        )
        history = [*body.history, Line(role="learner", text=body.reply)]
        user = f"The conversation so far:\nThem: {scene.line}\n{_conversation(history)}"
        ids = [point["id"] for point in situation["keyPoints"]]
        for _ in range(2):
            judged = await self._chat.json(system, user, ModelTurn)
            if judged.distress:
                return TurnResponse(status="distress")
            if judged.ruling:
                return TurnResponse(status="ruling")
            if judged.question:
                return TurnResponse(status="question")
            met = [point for point in ids if point in judged.met]
            if judged.done and not judged.line.strip():
                return TurnResponse(status="ended", met=met, tone=judged.tone)
            kept = await self._everyday({"line": judged.line}, locale)
            if "line" in kept:
                status = "ended" if judged.done else "continued"
                return TurnResponse(status=status, line=kept["line"], met=met, tone=judged.tone)
            user += "\n\n(Your last line made a religious statement. Speak as an ordinary person.)"
        return TurnResponse(status="unavailable")

    async def explain(self, body: ExplainRequest) -> RafiqAnswer | None:
        """Rafiq on one quote of the situation: the quote is the line he explains, as context (its
        sources are found and cited by his own pipeline). None for an unknown quote."""
        situation = self._situations.get(body.situation_id)
        quote = situation["quotes"].get(body.quote_ref) if situation else None
        if situation is None or quote is None:
            return None
        lessons = situation.get("lessons") or [""]
        question = (
            body.question if body.mode == "question" and body.question else quote[body.locale]
        )
        return await self._rafiq.run(
            question,
            body.locale,
            history=body.history,
            lesson={"lesson_id": lessons[0], "line": quote[body.locale], "mode": body.mode},
        )

    async def feedback(self, body: FeedbackRequest) -> FeedbackResponse:
        started = time.perf_counter()
        situation = self._situations.get(body.situation_id)
        if situation is None:
            return FeedbackResponse(status="unknownSituation")
        try:
            response = await asyncio.wait_for(self._feedback(body, situation), TIME_BUDGET)
        except (TimeoutError, ModelUnavailableError):
            response = FeedbackResponse(status="unavailable")
        log.info(
            "mawqif feedback status=%s replies=%d ms=%d",
            response.status,
            len(response.replies),
            (time.perf_counter() - started) * 1000,
        )
        return response

    async def _feedback(self, body: FeedbackRequest, situation: Situation) -> FeedbackResponse:
        locale = body.locale
        vocative = VOCATIVE["ar" if locale == "ar" else "other"]
        system = _prompt(
            "feedback",
            title=situation["title"][locale],
            language_name=spec(locale).name,
            points=_points(situation, locale),
            met=", ".join(body.met) or "none",
            say="\n".join(f"{{{{say:{say['id']}}}}}: {say[locale]}" for say in situation["say"]),
            name_rule=NAME_DUE.format(field="good", vocative=vocative).replace(
                "this reply", "this feedback"
            ),
        )
        replies = [line for line in body.history if line.role == "learner"]
        numbered = "\n".join(f"Reply {n}: <<<{line.text}>>>" for n, line in enumerate(replies, 1))
        user = (
            f"The conversation:\nThem: {body.scene.line}\n{_conversation(body.history)}"
            f"\n\nThe learner's replies:\n{numbered}"
        )
        judged = await self._chat.json(system, user, ModelFeedback)
        ids = [point["id"] for point in situation["keyPoints"]]
        given = {item.n: item for item in judged.replies}
        result: list[ReplyFeedback] = []
        for n in range(1, len(replies) + 1):
            item = given.get(n, ReplyFeedback(n=n))
            # The turns already judged the key points; feedback does not contradict them. A
            # better reply given only for points met elsewhere has nothing left to add.
            missing = [point for point in ids if point in item.missing and point not in body.met]
            only_met = bool(item.missing) and not missing
            lines = {"good": item.good}
            better = (
                fill_says(item.better, situation, locale)
                if item.better.strip() and not only_met
                else None
            )
            if better:
                lines["better"] = better[1] or "…"
            kept = await self._everyday({k: v for k, v in lines.items() if v.strip()}, locale)
            result.append(
                ReplyFeedback(
                    n=n,
                    good=kept.get("good", ""),
                    missing=missing,
                    better=better[0] if better and "better" in kept else "",
                )
            )
        return FeedbackResponse(status="ready", replies=result)
