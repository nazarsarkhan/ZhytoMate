"""
Purpose:   Pydantic v2 I/O schemas for POST /api/v1/assistant/extract-slots — a generic,
           domain-agnostic structured-extraction endpoint. backend_app supplies the slot schema
           per-request (field names/descriptions/enum values); ml-service never hardcodes what an
           "appeal" or any other action's fields are. current_slots and enum_values are capped (on
           item count AND per-string length), not just message/slot_schema, because both get
           serialized directly into the LLM prompt (domain/prompts.py::build_slot_extraction_prompt)
           and current_slots specifically accumulates across many conversation turns — an unbounded
           dict/list is a real path to runaway prompt size, the same risk every other prompt-bound
           input in app/schemas/ already guards against (QueryRequest.user_query at 1000,
           IngestRequest.text at 50k).
Layer:     schema
May import:   stdlib, pydantic
Must NOT import:  api/*, services/*, components/*, domain/*; any I/O or model lib
"""
from __future__ import annotations

from typing import Annotated

from pydantic import BaseModel, Field

# A filled slot value (an address, a short answer) or a field's declared choice list — generous
# but capped, mirroring the same order of magnitude as SlotFieldSchema.description/name below.
# Public (no leading underscore): action_service.py reuses this exact cap to truncate its own
# extraction response, so an oversized value can never round-trip back in as a future request's
# current_slots and fail this same validation.
MAX_SLOT_VALUE_LENGTH = 500
_MAX_ENUM_VALUES = 50


class SlotFieldSchema(BaseModel):
    name: str = Field(..., min_length=1, max_length=64)
    description: str = Field(..., min_length=1, max_length=256)
    enum_values: list[Annotated[str, Field(min_length=1, max_length=64)]] | None = Field(
        default=None, max_length=_MAX_ENUM_VALUES
    )


class SlotExtractionRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)
    slot_schema: list[SlotFieldSchema] = Field(..., min_length=1, max_length=20)
    current_slots: dict[str, Annotated[str, Field(max_length=MAX_SLOT_VALUE_LENGTH)]] = Field(
        default_factory=dict, max_length=20
    )


class SlotExtractionResponse(BaseModel):
    slots: dict[str, str]
    wants_cancel: bool
    is_unrelated: bool
