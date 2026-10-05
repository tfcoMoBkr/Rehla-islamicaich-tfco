"""The shared key between the web app's proxy and this service.

The service's URL is public, so anyone could call it and spend the model budget. When
AI_SERVICE_KEY is set, every request must carry it in the `x-rehla-key` header (only the web
app's server-side proxy knows it); without the variable, as in local development, all requests
are accepted. No CORS headers are sent, so no browser page can call the service directly.
"""

import hmac

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, Response
from starlette.middleware.base import RequestResponseEndpoint

from app.config import get_settings

KEY_HEADER = "x-rehla-key"
# The learner's address as the proxy saw it; trusted only on requests that carry the key.
CLIENT_HEADER = "x-rehla-client"


def key_required() -> bool:
    return get_settings().ai_service_key is not None


def has_key(request: Request) -> bool:
    key = get_settings().ai_service_key
    if key is None:
        return True
    supplied = request.headers.get(KEY_HEADER, "")
    return hmac.compare_digest(supplied.encode(), key.get_secret_value().encode())


def install_service_key(app: FastAPI) -> None:
    @app.middleware("http")
    async def require_key(request: Request, call_next: RequestResponseEndpoint) -> Response:
        if not has_key(request):
            return JSONResponse({"error": {"code": "unauthorized"}}, status_code=401)
        return await call_next(request)
