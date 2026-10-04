import logging
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI

from app import __version__
from app.api import RateLimiter, Services, install_error_handlers
from app.api import router as rafiq_router
from app.config import get_settings
from app.health import router as health_router
from app.index import Index
from app.llm import ModelUnavailableError, OpenRouterChat, OpenRouterEmbedder
from app.rafiq.graph import Rafiq
from app.retrieval.mcp import McpClient
from app.retrieval.retriever import Retriever

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
log = logging.getLogger("rafiq")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    async with httpx.AsyncClient() as client:
        rafiq = None
        try:
            index = Index.load(settings.index_dir)
            retriever = Retriever(
                index, OpenRouterEmbedder(settings, client), McpClient(settings.mcp_url)
            )
            # Drafts are never logged on a deployment, whatever RAFIQ_DEBUG says.
            debug = settings.rafiq_debug and "VERCEL" not in os.environ
            rafiq = Rafiq(OpenRouterChat(settings, client), retriever, debug=debug)
            log.info("index loaded: %d chunks", len(index.chunks))
        except (ModelUnavailableError, FileNotFoundError) as error:
            log.warning("Rafiq is unavailable: %s", error)
        app.state.services = Services(rafiq=rafiq, limiter=RateLimiter(settings.asks_per_minute))
        yield


app = FastAPI(title="Rehla AI service", version=__version__, lifespan=lifespan)
app.include_router(health_router)
app.include_router(rafiq_router)
install_error_handlers(app)
