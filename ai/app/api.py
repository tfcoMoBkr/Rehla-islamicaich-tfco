"""Rafiq's HTTP API: POST /ask and POST /lesson-help.

Questions and answers are neither stored nor logged; logs carry only the outcome, timings and
counts. Errors share one shape: {"error": {"code": "...", ...}}.
"""

import time
from collections import deque
from dataclasses import dataclass

from fastapi import APIRouter, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.llm import ModelUnavailableError
from app.rafiq.graph import Rafiq
from app.rafiq.schemas import AskRequest, LessonHelpRequest, RafiqAnswer

router = APIRouter(tags=["rafiq"])


class ApiError(Exception):
    def __init__(self, status: int, code: str, retry_after: int | None = None) -> None:
        self.status, self.code, self.retry_after = status, code, retry_after


class RateLimiter:
    """At most `limit` requests per client address in any 60 seconds (in memory, per instance)."""

    def __init__(self, limit: int) -> None:
        self._limit = limit
        self._seen: dict[str, deque[float]] = {}

    def check(self, client: str) -> None:
        now = time.monotonic()
        recent = self._seen.setdefault(client, deque())
        while recent and now - recent[0] > 60:
            recent.popleft()
        if len(recent) >= self._limit:
            raise ApiError(429, "rate_limited", retry_after=int(60 - (now - recent[0])) + 1)
        recent.append(now)


@dataclass
class Services:
    rafiq: Rafiq | None
    limiter: RateLimiter


def _client(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _services(request: Request) -> tuple[Rafiq, RateLimiter]:
    services: Services = request.app.state.services
    services.limiter.check(_client(request))
    if services.rafiq is None:
        raise ApiError(503, "unavailable")
    return services.rafiq, services.limiter


@router.post("/ask", response_model=RafiqAnswer, response_model_by_alias=True)
async def ask(body: AskRequest, request: Request) -> RafiqAnswer:
    rafiq, _ = _services(request)
    try:
        return await rafiq.run(
            body.question, body.locale, history=body.history, scope=body.reached_lesson_ids
        )
    except ModelUnavailableError as error:
        raise ApiError(503, "unavailable") from error


@router.post("/lesson-help", response_model=RafiqAnswer, response_model_by_alias=True)
async def lesson_help(body: LessonHelpRequest, request: Request) -> RafiqAnswer:
    rafiq, _ = _services(request)
    if body.mode == "question" and not (body.question and body.question.strip()):
        raise ApiError(422, "question_required")
    question = (
        body.question.strip() if body.mode == "question" and body.question else body.line_text
    )
    try:
        return await rafiq.run(
            question,
            body.locale,
            scope=[body.lesson_id],
            lesson={"lesson_id": body.lesson_id, "line": body.line_text, "mode": body.mode},
        )
    except ModelUnavailableError as error:
        raise ApiError(503, "unavailable") from error


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def api_error(_request: Request, error: ApiError) -> JSONResponse:
        body: dict[str, object] = {"code": error.code}
        headers = {}
        if error.retry_after is not None:
            body["retryAfter"] = error.retry_after
            headers["Retry-After"] = str(error.retry_after)
        return JSONResponse({"error": body}, status_code=error.status, headers=headers)

    @app.exception_handler(RequestValidationError)
    async def invalid(_request: Request, error: RequestValidationError) -> JSONResponse:
        # The fields at fault and why, never the values sent (they may hold the question).
        fields = [
            {"field": ".".join(str(part) for part in issue["loc"][1:]), "problem": issue["type"]}
            for issue in error.errors()
        ]
        return JSONResponse(
            {"error": {"code": "invalid_request", "fields": fields}}, status_code=422
        )
