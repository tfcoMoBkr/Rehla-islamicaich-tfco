"""Rafiq's HTTP API: POST /ask, POST /lesson-help, POST /lens and POST /mawqif/evaluate.

Questions and answers are neither stored nor logged; logs carry only the outcome, timings and
counts. Errors share one shape: {"error": {"code": "...", ...}}.
"""

import base64
import binascii
import threading
import time
from collections import deque
from collections.abc import Callable
from dataclasses import dataclass, field

from fastapi import APIRouter, FastAPI, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.lens.lens import Lens
from app.lens.schemas import LensRequest, LensResponse
from app.llm import ModelUnavailableError
from app.mawqif.evaluate import Evaluator
from app.mawqif.schemas import EvaluateRequest, EvaluateResponse
from app.rafiq.graph import Rafiq
from app.rafiq.schemas import AskRequest, LessonHelpRequest, RafiqAnswer
from app.security import CLIENT_HEADER, key_required

router = APIRouter(tags=["rafiq"])


class ApiError(Exception):
    def __init__(self, status: int, code: str, retry_after: int | None = None) -> None:
        self.status, self.code, self.retry_after = status, code, retry_after


class RateLimiter:
    """At most `limit` requests per client address in any 60 seconds.

    In memory, per instance: on serverless hosting each instance counts on its own, so this is a
    best-effort guard, not a hard quota."""

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
    limiter: RateLimiter
    rafiq: Rafiq | None = None
    # Builds Rafiq (and loads the index) on first use, so a cold instance answers /health at once.
    load: Callable[[], Rafiq | None] | None = None
    # Lens has its own, tighter limit, and is built on Rafiq when VLM_MODEL is set.
    lens_limiter: RateLimiter = field(default_factory=lambda: RateLimiter(5))
    lens: Lens | None = None
    load_lens: Callable[[Rafiq], Lens | None] | None = None
    # Mawqif judges written replies with Rafiq's chat models, under its own limit.
    mawqif_limiter: RateLimiter = field(default_factory=lambda: RateLimiter(10))
    evaluator: Evaluator | None = None
    load_evaluator: Callable[[Rafiq], Evaluator | None] | None = None
    _lock: threading.Lock = field(default_factory=threading.Lock, repr=False)

    def get(self) -> Rafiq | None:
        if self.rafiq is None and self.load is not None:
            with self._lock:
                if self.rafiq is None and self.load is not None:
                    self.rafiq, self.load = self.load(), None
        return self.rafiq

    def get_evaluator(self) -> Evaluator | None:
        rafiq = self.get()
        if self.evaluator is None and rafiq is not None and self.load_evaluator is not None:
            with self._lock:
                if self.evaluator is None and self.load_evaluator is not None:
                    self.evaluator, self.load_evaluator = self.load_evaluator(rafiq), None
        return self.evaluator

    def get_lens(self) -> Lens | None:
        rafiq = self.get()
        if self.lens is None and rafiq is not None and self.load_lens is not None:
            with self._lock:
                if self.lens is None and self.load_lens is not None:
                    self.lens, self.load_lens = self.load_lens(rafiq), None
        return self.lens


def _client(request: Request) -> str:
    # Behind the web app's proxy every request comes from the proxy; it passes the learner's
    # address along, and that header is believed only when the shared key is in use.
    proxied = request.headers.get(CLIENT_HEADER)
    if proxied and key_required():
        return proxied.strip()
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def _services(request: Request) -> tuple[Rafiq, RateLimiter]:
    services: Services = request.app.state.services
    services.limiter.check(_client(request))
    rafiq = await run_in_threadpool(services.get)
    if rafiq is None:
        raise ApiError(503, "unavailable")
    return rafiq, services.limiter


@router.post("/ask", response_model=RafiqAnswer, response_model_by_alias=True)
async def ask(body: AskRequest, request: Request) -> RafiqAnswer:
    rafiq, _ = await _services(request)
    try:
        return await rafiq.run(
            body.question, body.locale, history=body.history, scope=body.reached_lesson_ids
        )
    except ModelUnavailableError as error:
        raise ApiError(503, "unavailable") from error


@router.post("/lesson-help", response_model=RafiqAnswer, response_model_by_alias=True)
async def lesson_help(body: LessonHelpRequest, request: Request) -> RafiqAnswer:
    rafiq, _ = await _services(request)
    if body.mode == "question" and not (body.question and body.question.strip()):
        raise ApiError(422, "question_required")
    question = (
        body.question.strip() if body.mode == "question" and body.question else body.line_text
    )
    # The lesson first, then the lessons the learner has reached.
    scope = list(dict.fromkeys([body.lesson_id, *(body.reached_lesson_ids or [])]))
    try:
        return await rafiq.run(
            question,
            body.locale,
            history=body.history,
            scope=scope,
            lesson={"lesson_id": body.lesson_id, "line": body.line_text, "mode": body.mode},
        )
    except ModelUnavailableError as error:
        raise ApiError(503, "unavailable") from error


# The browser downscales a photo to 1280 px as JPEG; anything larger is not a photo from Lens.
MAX_IMAGE_BYTES = 4 * 1024 * 1024
SIGNATURES = {
    "image/jpeg": b"\xff\xd8\xff",
    "image/png": b"\x89PNG\r\n\x1a\n",
    "image/webp": b"RIFF",
}


def image_url(body: LensRequest) -> str | None:
    """The photo as a data URL for the vision model, after checking its size and its type by its
    own bytes (not by what the request claims). It is never written anywhere."""
    if body.image is None:
        return None
    try:
        data = base64.b64decode(body.image, validate=True)
    except (binascii.Error, ValueError) as error:
        raise ApiError(422, "image_type") from error
    if len(data) > MAX_IMAGE_BYTES:
        raise ApiError(413, "image_too_large")
    if not data.startswith(SIGNATURES[body.mime_type]):
        raise ApiError(422, "image_type")
    if body.mime_type == "image/webp" and data[8:12] != b"WEBP":
        raise ApiError(422, "image_type")
    return f"data:{body.mime_type};base64,{body.image}"


@router.post("/lens", response_model=LensResponse, response_model_by_alias=True)
async def lens(body: LensRequest, request: Request) -> LensResponse:
    services: Services = request.app.state.services
    services.lens_limiter.check(_client(request))
    if body.image is None and body.seen is None:
        raise ApiError(422, "image_required")
    url = image_url(body)
    reader = await run_in_threadpool(services.get_lens)
    if reader is None:
        raise ApiError(503, "unavailable")
    try:
        return await reader.run(
            body.locale, image=url, seen=body.seen, scope=body.reached_lesson_ids
        )
    except ModelUnavailableError as error:
        raise ApiError(503, "unavailable") from error


@router.post("/mawqif/evaluate", response_model=EvaluateResponse, response_model_by_alias=True)
async def mawqif_evaluate(body: EvaluateRequest, request: Request) -> EvaluateResponse:
    """A learner's written reply in a role-play, judged against that turn's key points only."""
    services: Services = request.app.state.services
    services.mawqif_limiter.check(_client(request))
    evaluator = await run_in_threadpool(services.get_evaluator)
    if evaluator is None:
        raise ApiError(503, "unavailable")
    return await evaluator.evaluate(body)


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
