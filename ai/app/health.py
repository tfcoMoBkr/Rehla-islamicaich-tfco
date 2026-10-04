from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

from app import __version__
from app.config import SERVICE_NAME

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    service: str
    version: str
    status: Literal["ok"]


@router.get("/health")
def health() -> HealthResponse:
    return HealthResponse(service=SERVICE_NAME, version=__version__, status="ok")
