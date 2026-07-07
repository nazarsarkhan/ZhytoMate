"""
Purpose:   POST /api/v1/assistant/extract-slots — generic structured-extraction endpoint backing
           the assistant actions framework. HTTP wiring only; extraction logic lives in
           ActionService.
Layer:     api
May import:   FastAPI (APIRouter, Depends), schemas/actions, app.deps (auth + service accessor)
Must NOT import:  components/* or repository directly; domain/* directly; asyncpg
"""
from __future__ import annotations

from fastapi import APIRouter, Depends

from app.deps import get_action_service, verify_internal_token
from app.schemas.actions import SlotExtractionRequest, SlotExtractionResponse

router = APIRouter(prefix="/api/v1/assistant", tags=["assistant"])


@router.post(
    "/extract-slots",
    response_model=SlotExtractionResponse,
    dependencies=[Depends(verify_internal_token)],
)
async def extract_slots(
    body: SlotExtractionRequest,
    svc=Depends(get_action_service),
) -> SlotExtractionResponse:
    """Extract/merge structured slots from a message against a caller-supplied schema. See
    docs/superpowers/specs/2026-07-06-assistant-actions-framework-design.md."""
    return await svc.extract_slots(body)
