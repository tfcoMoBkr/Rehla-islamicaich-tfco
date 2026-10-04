from fastapi import FastAPI

from app import __version__
from app.health import router as health_router

app = FastAPI(title="Rehla AI service", version=__version__)
app.include_router(health_router)
