"""
Health check endpoints.
"""

from fastapi import APIRouter
from pydantic import BaseModel
from datetime import datetime

router = APIRouter()


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    timestamp: datetime


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """
    Check if the Cognigate Engine is healthy.
    """
    return HealthResponse(
        status="healthy",
        service="cognigate-engine",
        version="0.1.0",
        timestamp=datetime.utcnow(),
    )


@router.get("/ready")
async def readiness_check() -> dict[str, str]:
    """
    Check if the service is ready to accept requests.
    """
    return {"status": "ready"}
