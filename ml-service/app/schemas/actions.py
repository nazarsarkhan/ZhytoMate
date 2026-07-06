"""
Purpose:   Pydantic v2 I/O schemas for POST /api/v1/assistant/extract-slots — a generic,
           domain-agnostic structured-extraction endpoint. backend_app supplies the slot schema
           per-request (field names/descriptions/enum values); ml-service never hardcodes what an
           "appeal" or any other action's fields are.
Layer:     schema
May import:   stdlib, pydantic
Must NOT import:  api/*, services/*, components/*, domain/*; any I/O or model lib
"""
from __future__ import annotations

from pydantic import BaseModel, Field


class SlotFieldSchema(BaseModel):
    name: str = Field(..., min_length=1, max_length=64)
    description: str = Field(..., min_length=1, max_length=256)
    enum_values: list[str] | None = None


class SlotExtractionRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)
    slot_schema: list[SlotFieldSchema] = Field(..., min_length=1, max_length=20)
    current_slots: dict[str, str] = Field(default_factory=dict)


class SlotExtractionResponse(BaseModel):
    slots: dict[str, str]
    wants_cancel: bool
    is_unrelated: bool
