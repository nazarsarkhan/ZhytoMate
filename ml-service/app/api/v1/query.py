"""
Purpose:   POST /api/v1/chat/query — validate auth + body, delegate to RagService, return
           QueryResponse. HTTP wiring only; rate limiting and the no-info/fallback tail live in the
           service.
Layer:     api
May import:   FastAPI (APIRouter, Depends), schemas/query, app.deps (auth + service accessor)
Must NOT import:  components/* or repository directly; domain/* directly; google-genai, asyncpg, sentence-transformers
"""
from __future__ import annotations

from fastapi import APIRouter, Depends

from app.deps import get_rag_service, verify_internal_token
from app.schemas.query import QueryRequest, QueryResponse

router = APIRouter(prefix="/api/v1/chat", tags=["chat"])


@router.post(
    "/query",
    response_model=QueryResponse,
    dependencies=[Depends(verify_internal_token)],
)
async def query_knowledge_base(
    body: QueryRequest,
    svc=Depends(get_rag_service),
) -> QueryResponse:
    """Answer a civic question via hybrid RAG. See docs/SYSTEM_DESIGN.md §3.2 for the contract."""
    return await svc.query(body)
