"""
Purpose:   ActionService.extract_slots — generic structured-extraction over a caller-supplied slot
           schema (§ assistant actions framework design). Never persists anything, never knows what
           the fields mean beyond their description strings; backend_app owns all domain logic
           (what an "appeal" is, what to do once slots are filled). Fails closed to
           is_unrelated=True on any parse/call failure, never silently inventing or dropping slot
           data — the caller's draft state must stay exactly as it was before a failed extraction.
Layer:     service
May import:   domain/prompts, schemas/actions, app.protocols (Generator port), structlog
Must NOT import:  other services/*, api/*, FastAPI/Starlette, asyncpg, openai directly
"""
from __future__ import annotations

import json

import structlog

from app.domain.prompts import build_slot_extraction_prompt
from app.protocols import Generator
from app.schemas.actions import SlotExtractionRequest, SlotExtractionResponse

logger = structlog.get_logger(__name__)

_EXTRACTION_TEMPERATURE = 0.0
_EXTRACTION_MAX_TOKENS = 512
_EXTRACTION_TIMEOUT_S = 8.0


class ActionService:
    def __init__(self, generator: Generator) -> None:
        self._generator = generator

    async def extract_slots(self, request: SlotExtractionRequest) -> SlotExtractionResponse:
        prompt = build_slot_extraction_prompt(
            message=request.message,
            slot_schema=request.slot_schema,
            current_slots=request.current_slots,
        )
        try:
            raw, _ = await self._generator.generate(
                prompt,
                temperature=_EXTRACTION_TEMPERATURE,
                max_tokens=_EXTRACTION_MAX_TOKENS,
                timeout_s=_EXTRACTION_TIMEOUT_S,
                json_mode=True,
            )
            parsed = json.loads(raw[raw.find("{") : raw.rfind("}") + 1])
            extracted = parsed.get("slots")
            if not isinstance(extracted, dict):
                raise ValueError("slots field missing or not an object")
            merged = {**request.current_slots, **extracted}
            return SlotExtractionResponse(
                slots=merged,
                wants_cancel=parsed.get("wants_cancel") is True,
                is_unrelated=parsed.get("is_unrelated") is True,
            )
        except Exception as exc:  # noqa: BLE001 — fail closed: never invent/drop slot data
            logger.warning("slot_extraction_failed", err=type(exc).__name__)
            return SlotExtractionResponse(
                slots=dict(request.current_slots), wants_cancel=False, is_unrelated=True
            )
