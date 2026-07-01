"""
Purpose:   POST /api/v1/vision/analyze — validate auth + image (mime allowlist + decoded-size cap in
           the schema), decode, and delegate to VisionService. HTTP wiring only.
Layer:     api
May import:   FastAPI (APIRouter, Depends), schemas/vision, app.deps (auth + service accessor)
Must NOT import:  components/* or repository directly; domain/* directly; asyncpg
"""
from __future__ import annotations

from fastapi import APIRouter, Depends

from app.deps import get_vision_service, verify_internal_token
from app.schemas.vision import VisionRequest, VisionResponse

router = APIRouter(prefix="/api/v1/vision", tags=["vision"])


@router.post(
    "/analyze",
    response_model=VisionResponse,
    dependencies=[Depends(verify_internal_token)],
)
async def analyze_image(
    body: VisionRequest,
    svc=Depends(get_vision_service),
) -> VisionResponse:
    """Classify a citizen photo report. See docs/SYSTEM_DESIGN.md §3.3 for the contract."""
    image_bytes = body.decode_image()
    return await svc.analyze(image_bytes, body.mime_type)
