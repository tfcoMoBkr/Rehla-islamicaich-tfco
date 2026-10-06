import logging
import os
import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI

from app import __version__
from app.api import DailyCap, RateLimiter, Services, install_error_handlers
from app.api import router as rafiq_router
from app.config import Settings, get_settings
from app.health import router as health_router
from app.index import Index
from app.lens.lens import Lens
from app.llm import ModelUnavailableError, OpenRouterChat, OpenRouterEmbedder
from app.mawqif.evaluate import Evaluator, load_key_points
from app.mawqif.practice import Practice, load_situations
from app.rafiq.glossary import Glossary
from app.rafiq.graph import Rafiq
from app.rafiq.road import Road
from app.retrieval.mcp import McpClient
from app.retrieval.retriever import Retriever
from app.security import install_service_key

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
log = logging.getLogger("rafiq")


def load_rafiq(settings: Settings, client: httpx.AsyncClient) -> Rafiq | None:
    """Loads the index and builds Rafiq; None when the index or the models are not available."""
    started = time.perf_counter()
    try:
        index = Index.load(settings.index_dir)
        retriever = Retriever(
            index, OpenRouterEmbedder(settings, client), McpClient(settings.mcp_url)
        )
        # Drafts are never logged on a deployment, whatever RAFIQ_DEBUG says.
        debug = settings.rafiq_debug and "VERCEL" not in os.environ
        road = Road.load(settings.index_dir / "road.json")
        glossary = Glossary.load(settings.index_dir, index)
        rafiq = Rafiq(
            OpenRouterChat(settings, client), retriever, debug=debug, road=road, glossary=glossary
        )
    except (ModelUnavailableError, FileNotFoundError) as error:
        log.warning("Rafiq is unavailable: %s", error)
        return None
    log.info("index loaded: %d chunks in %.2fs", len(index.chunks), time.perf_counter() - started)
    return rafiq


def load_lens(settings: Settings, client: httpx.AsyncClient, rafiq: Rafiq) -> Lens | None:
    """Lens on top of Rafiq; None when no vision model is configured."""
    try:
        vision = OpenRouterChat(settings, client, vision=True)
    except ModelUnavailableError as error:
        log.warning("Lens is unavailable: %s", error)
        return None
    return Lens(vision, rafiq, rafiq.retriever)


def load_evaluator(settings: Settings, rafiq: Rafiq) -> Evaluator | None:
    """Mawqif's reply evaluation, on Rafiq's chat models; None when the key points are missing."""
    path = settings.index_dir / "mawqif-turns.json"
    if not path.is_file():
        log.warning("Mawqif evaluation is unavailable: %s is missing", path.name)
        return None
    return Evaluator(rafiq.chat, load_key_points(path))


def load_practice(settings: Settings, rafiq: Rafiq) -> Practice | None:
    """Mawqif's practice conversations, on Rafiq's chat models; None when the data is missing."""
    path = settings.index_dir / "mawqif-practice.json"
    if not path.is_file():
        log.warning("Mawqif practice is unavailable: %s is missing", path.name)
        return None
    return Practice(rafiq.chat, rafiq, load_situations(path))


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    async with httpx.AsyncClient() as client:
        # Rafiq is built on the first question, not at startup, so /health answers a cold
        # start at once.
        app.state.services = Services(
            limiter=RateLimiter(settings.asks_per_minute),
            daily=DailyCap(settings.daily_question_cap),
            load=lambda: load_rafiq(settings, client),
            lens_limiter=RateLimiter(settings.lens_per_minute),
            load_lens=lambda rafiq: load_lens(settings, client, rafiq),
            mawqif_limiter=RateLimiter(settings.asks_per_minute),
            load_evaluator=lambda rafiq: load_evaluator(settings, rafiq),
            load_practice=lambda rafiq: load_practice(settings, rafiq),
            community_limiter=RateLimiter(settings.asks_per_minute),
        )
        yield


app = FastAPI(title="Rehla AI service", version=__version__, lifespan=lifespan)
app.include_router(health_router)
app.include_router(rafiq_router)
install_error_handlers(app)
install_service_key(app)
