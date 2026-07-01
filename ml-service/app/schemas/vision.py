"""
Purpose:   Pydantic v2 I/O schemas for POST /api/v1/vision/analyze — VisionRequest (mime allowlist +
           decoded-size cap) and VisionResponse (9-category, severity 1..5). ALLOWED_CATEGORIES is
           derived from CATEGORY_VALUES for the service's manual enum check.
Layer:     schema
May import:   stdlib, pydantic
Must NOT import:  api/*, services/*, components/*, domain/*; any I/O or model lib (asyncpg, FastAPI routing)
"""
from __future__ import annotations

import base64
from typing import Literal, get_args

from pydantic import BaseModel, Field, field_validator

ALLOWED_MIME_TYPES = frozenset({"image/jpeg", "image/png", "image/webp"})
MAX_IMAGE_BYTES = 4 * 1024 * 1024  # 4 MB decoded

CATEGORY_VALUES = Literal[
    "pothole", "road_damage", "garbage", "illegal_dumping",
    "street_lighting", "water_leak", "fallen_tree", "vandalism", "other",
]
# Runtime set derived from the Literal so the service can check the model's category without drift.
ALLOWED_CATEGORIES: frozenset[str] = frozenset(get_args(CATEGORY_VALUES))


class VisionRequest(BaseModel):
    image_base64: str = Field(..., min_length=1)
    mime_type: str

    @field_validator("mime_type")
    @classmethod
    def _validate_mime(cls, value: str) -> str:
        if value not in ALLOWED_MIME_TYPES:
            raise ValueError(f"mime_type must be one of {sorted(ALLOWED_MIME_TYPES)}")
        return value

    @field_validator("image_base64")
    @classmethod
    def _validate_size(cls, value: str) -> str:
        """Reject non-base64 and images whose decoded size exceeds the cap. Returns the original b64."""
        try:
            decoded = base64.b64decode(value, validate=True)
        except Exception as exc:
            raise ValueError("image_base64 is not valid base64") from exc
        if len(decoded) > MAX_IMAGE_BYTES:
            raise ValueError(f"decoded image exceeds {MAX_IMAGE_BYTES // (1024 * 1024)} MB")
        return value

    def decode_image(self) -> bytes:
        """Raw image bytes — called once in the service after validation."""
        return base64.b64decode(self.image_base64)


class VisionResponse(BaseModel):
    is_valid: bool
    category: str  # one of CATEGORY_VALUES, or "other" on fallback (enum enforced in the service)
    severity: int = Field(..., ge=1, le=5)
    title: str
    description: str
