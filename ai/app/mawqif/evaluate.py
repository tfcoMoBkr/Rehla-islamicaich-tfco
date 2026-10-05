"""Judges a reply a learner wrote in a Mawqif role-play against that turn's key points.

1. The reply is checked in code for signs of danger (safety.py) before any model sees it.
2. One model call returns which key points the reply covers, its tone, whether it is a religious
   question rather than a reply, whether it is about something hard happening to the learner, and
   at most one encouraging sentence.
3. Code decides what is shown: a question goes to Rafiq, distress to the specialist card, and an
   evaluation lists the key points met and missing by id (the page shows their quoted sources). The
   encouraging sentence passes Rafiq's warm-line checks (code, then the model check); otherwise
   it is dropped and the page shows a fixed line.

Nothing typed is stored or logged: logs carry counts and timings only.
"""

import asyncio
import json
import logging
import time
from pathlib import Path

from app.languages import spec
from app.llm import ChatModel, ModelUnavailableError
from app.mawqif.schemas import EvaluateRequest, EvaluateResponse, ModelEvaluation
from app.rafiq.graph import prompt as rafiq_prompt
from app.rafiq.safety import danger_signs
from app.rafiq.schemas import PageLocale, SupportCheck
from app.rafiq.warmth import screened

log = logging.getLogger("mawqif")
PROMPT = Path(__file__).parent / "prompts" / "evaluate.md"
# A written reply is judged within this time, or the turn falls back to the written choices.
TIME_BUDGET = 20.0

KeyPoints = dict[str, dict[str, list[dict[str, str]]]]


def load_key_points(path: Path) -> KeyPoints:
    data: KeyPoints = json.loads(path.read_text(encoding="utf-8"))
    return data


class Evaluator:
    def __init__(self, chat: ChatModel, key_points: KeyPoints) -> None:
        self._chat = chat
        self._key_points = key_points

    def points(self, situation: str, turn: str) -> list[dict[str, str]] | None:
        return self._key_points.get(situation, {}).get(turn)

    async def _encouragement(self, text: str, locale: PageLocale) -> str | None:
        """The sentence if it passes Rafiq's warm-line checks: code first, then the model check."""
        kept = screened({"followUp": text}, [], locale)
        line = kept.get("followUp")
        if not line:
            return None
        try:
            check = await self._chat.json(
                rafiq_prompt("verify", ruling_rule=""), f"Warm line followUp: {line}", SupportCheck
            )
        except ModelUnavailableError:
            return None
        return None if "followUp" in check.religious else line

    async def _judge(self, body: EvaluateRequest, points: list[dict[str, str]]) -> EvaluateResponse:
        listing = "\n".join(f"{point['id']}: {point[body.locale]}" for point in points)
        system = PROMPT.read_text(encoding="utf-8").replace(
            "{language_name}", spec(body.locale).name
        )
        user = f"Key points:\n{listing}\n\nThe learner's reply:\n<<<\n{body.reply}\n>>>"
        judged = await self._chat.json(system, user, ModelEvaluation)
        if judged.distress:
            return EvaluateResponse(status="distress")
        if judged.asks_question:
            return EvaluateResponse(status="question")
        ids = [point["id"] for point in points]
        met = [point for point in ids if point in judged.met]
        encouragement = (
            await self._encouragement(judged.encouragement, body.locale)
            if judged.encouragement.strip()
            else None
        )
        return EvaluateResponse(
            status="evaluated",
            met=met,
            missing=[point for point in ids if point not in met],
            tone=judged.tone,
            encouragement=encouragement,
        )

    async def evaluate(self, body: EvaluateRequest) -> EvaluateResponse:
        started = time.perf_counter()
        points = self.points(body.situation_id, body.turn_id)
        if points is None:
            response = EvaluateResponse(status="unknownTurn")
        elif danger_signs(body.reply):
            response = EvaluateResponse(status="danger")
        else:
            try:
                response = await asyncio.wait_for(self._judge(body, points), TIME_BUDGET)
            except (TimeoutError, ModelUnavailableError):
                response = EvaluateResponse(status="unavailable")
        log.info(
            "mawqif status=%s met=%d missing=%d ms=%d",
            response.status,
            len(response.met),
            len(response.missing),
            (time.perf_counter() - started) * 1000,
        )
        return response
