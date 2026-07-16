"""
Purpose:   Pydantic v2 I/O schemas for POST /api/v1/chat/query — QueryRequest / SourceUsed /
           QueryResponse.
Layer:     schema
May import:   stdlib, pydantic, schemas/common (QueryRoute)
Must NOT import:  api/*, services/*, components/*, domain/*; any I/O or model lib (asyncpg, FastAPI
              routing)
"""
from __future__ import annotations

from pydantic import BaseModel, Field

from app.schemas.common import QueryRoute


class QueryRequest(BaseModel):
    user_query: str = Field(..., min_length=1, max_length=1000)
    # Telegram id — rate limit + hashed logging only, never stored
    user_id: str = Field(..., min_length=1)
    district: str | None = None  # raw surface form — canonicalized in the service (§2.6)


class SourceUsed(BaseModel):
    source: str
    doc_type: str
    district: str | None
    similarity: float
    category: str | None = None


class AppLink(BaseModel):
    capability: str
    label: str
    route: str
    reason: str


class QueryResponse(BaseModel):
    answer: str
    sources_used: list[SourceUsed]
    confidence: float = Field(..., ge=0.0, le=1.0)
    route: QueryRoute | None = None  # observability only — the classifier's decision
    action_intent: str | None = None  # one of domain.actions.KNOWN_ACTIONS's keys, or None
    grounded: bool = False
    verified: bool = False
    answer_status: str = "ungrounded"
    app_links: list[AppLink] = Field(default_factory=list)
