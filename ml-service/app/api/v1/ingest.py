"""
Purpose:   POST /api/v1/knowledge/ingest — validate auth + body, delegate to IngestService, return
           IngestResponse. HTTP wiring only; no business logic, no error mapping (centralized in
           app.errors handlers).
Layer:     api
May import:   FastAPI (APIRouter, Depends), schemas/ingest, app.deps (auth + service accessor),
              app.services.ingest_service (type for the injected dependency)
Must NOT import:  components/* or repository directly; domain/* directly; google-genai, asyncpg, sentence-transformers
"""
from __future__ import annotations

from fastapi import APIRouter, Depends

from app.deps import get_ingest_service, verify_internal_token
from app.schemas.ingest import IngestRequest, IngestResponse
from app.services.ingest_service import IngestService

router = APIRouter(prefix="/api/v1/knowledge", tags=["knowledge"])


@router.post(
    "/ingest",
    response_model=IngestResponse,
    dependencies=[Depends(verify_internal_token)],
)
async def ingest_document(
    body: IngestRequest,
    svc: IngestService = Depends(get_ingest_service),
) -> IngestResponse:
    """Ingest a document into the knowledge base. See docs/SYSTEM_DESIGN.md §3.1 for the contract."""
    return await svc.ingest(body)
