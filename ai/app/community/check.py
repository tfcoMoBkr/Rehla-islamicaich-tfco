"""Checks a community post or reply before it is saved, for the writer's sake only.

1. Signs of danger, in code (safety.py), before any model sees the text.
2. One model call, strict JSON: is the writer in distress, and do they ask for a ruling on their own
   situation (better answered by Rafiq privately or by a specialist)?

3. Whether the text states a ruling, says what Islam teaches, or quotes a verse or hadith: in code
   for quoted scripture, then the same model call. Such a text is not published (the page says
   why and points to Rafiq or a specialist).

It fails closed: if the model is unavailable or slow (TIME_BUDGET), `checked` is False and the
page holds the post. The text is neither stored nor logged: logs carry the outcome and the
timing only.
"""

import asyncio
import logging
import re
import time
from pathlib import Path

from app.community.schemas import CheckRequest, CheckResponse, ModelCheck
from app.llm import ChatModel, ModelUnavailableError
from app.rafiq.safety import danger_signs

log = logging.getLogger("community")
PROMPT = Path(__file__).parent / "prompts" / "check.md"
TIME_BUDGET = 10.0
# Quoted scripture, found in code: Quran brackets, or words given as Allah's or the Prophet's.
SCRIPTURE = re.compile(
    r"[\ufd3e\ufd3f]|قال\s+(?:الله|تعالى|رسول\s+الله|النبي|الرسول)|يقول\s+(?:الله|تعالى)"
    r"|\b(?:the\s+)?(?:prophet|messenger)\b[^.]{0,30}\bsaid\b|\ballah\s+says\b",
    re.IGNORECASE,
)


class Checker:
    def __init__(self, chat: ChatModel) -> None:
        self._chat = chat

    async def _ask(self, body: CheckRequest) -> CheckResponse:
        system = PROMPT.read_text(encoding="utf-8")
        judged = await self._chat.json(system, f"<<<\n{body.text}\n>>>", ModelCheck)
        return CheckResponse(
            checked=True,
            distress=judged.distress,
            personal_ruling=judged.personal_ruling,
            religious_claim=judged.religious_claim or bool(SCRIPTURE.search(body.text)),
        )

    async def check(self, body: CheckRequest) -> CheckResponse:
        started = time.perf_counter()
        if danger_signs(body.text):
            response = CheckResponse(checked=True, danger=True)
        else:
            try:
                response = await asyncio.wait_for(self._ask(body), TIME_BUDGET)
            except (TimeoutError, ModelUnavailableError):
                # Fails closed: an unchecked post is held by the page, never published.
                response = CheckResponse(checked=False)
        log.info(
            "community check checked=%s danger=%s distress=%s ruling=%s claim=%s ms=%d",
            response.checked,
            response.danger,
            response.distress,
            response.personal_ruling,
            response.religious_claim,
            (time.perf_counter() - started) * 1000,
        )
        return response
