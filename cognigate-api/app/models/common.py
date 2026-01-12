"""
Common types and models used across the Cognigate Engine.
"""

from typing import Literal, Annotated
from pydantic import BaseModel, Field
import uuid
from datetime import datetime


# Type aliases
TrustLevel = Literal[0, 1, 2, 3, 4]
TrustScore = Annotated[int, Field(ge=0, le=1000)]
EntityId = str

# Trust level metadata
TRUST_LEVELS = {
    0: {"name": "Untrusted", "min_score": 0, "max_score": 199},
    1: {"name": "Provisional", "min_score": 200, "max_score": 399},
    2: {"name": "Trusted", "min_score": 400, "max_score": 599},
    3: {"name": "Verified", "min_score": 600, "max_score": 799},
    4: {"name": "Privileged", "min_score": 800, "max_score": 1000},
}


def generate_id(prefix: str = "") -> str:
    """Generate a unique ID with optional prefix."""
    return f"{prefix}{uuid.uuid4().hex[:12]}"


def utc_now() -> datetime:
    """Get current UTC timestamp."""
    return datetime.utcnow()


class BaseResponse(BaseModel):
    """Base response model with common fields."""

    request_id: str = Field(default_factory=lambda: generate_id("req_"))
    timestamp: datetime = Field(default_factory=utc_now)
    version: str = "1.0"
