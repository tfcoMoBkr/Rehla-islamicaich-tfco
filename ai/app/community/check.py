"""Checks a community post or reply before it is saved, for the writer's sake only.

1. Signs of danger, in code (safety.py), before any model sees the text.
2. One model call, strict JSON: is the writer in distress, and do they ask for a ruling on their own
   situation (better answered by Rafiq privately or by a specialist)?

The writer decides what to do after seeing the result; nothing is blocked here. If the model is
unavailable or slow (TIME_BUDGET), the check lets the post through. The text is neither stored nor
logged: logs carry the outcome and the timing only.
"""

import asyncio
import logging
import time
from pathlib import Path

from app.community.schemas import CheckRequest, CheckResponse, ModelCheck
from app.llm import ChatModel, ModelUnavailableError
from app.rafiq.safety import danger_signs

log = logging.getLogger("community")
PROMPT = Path(__file__).parent / "prompts" / "check.md"
TIME_BUDGET = 10.0


class Checker:
    def __init__(self, chat: ChatModel) -> None:
        self._chat = chat

    async def _ask(self, body: CheckRequest) -> CheckResponse:
        system = PROMPT.read_text(encoding="utf-8")
        judged = await self._chat.json(system, f"<<<\n{body.text}\n>>>", ModelCheck)
        return CheckResponse(
            checked=True, distress=judged.distress, personal_ruling=judged.personal_ruling
        )

    async def check(self, body: CheckRequest) -> CheckResponse:
        started = time.perf_counter()
        if danger_signs(body.text):
            response = CheckResponse(checked=True, danger=True)
        else:
            try:
                response = await asyncio.wait_for(self._ask(body), TIME_BUDGET)
            except (TimeoutError, ModelUnavailableError):
                # A safe fallback: the post goes through, and the writer is not held up.
                response = CheckResponse(checked=False)
        log.info(
            "community check checked=%s danger=%s distress=%s ruling=%s ms=%d",
            response.checked,
            response.danger,
            response.distress,
            response.personal_ruling,
            (time.perf_counter() - started) * 1000,
        )
        return response
