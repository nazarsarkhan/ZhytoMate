"""
Purpose:   IngestRequest / IngestResponse models for POST /api/v1/knowledge/ingest, including the
           ttl_days-required-when-news cross-field rule (§3.1). Validation lives here, not in the
           service or router.
Layer:     schema
May import:   stdlib, pydantic, schemas/common (DocType)
Must NOT import:  api/*, services/*, components/*, domain/*; any I/O or model lib (asyncpg, FastAPI routing)
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.schemas.common import DocType


class IngestRequest(BaseModel):
    document_id: str = Field(..., min_length=1, max_length=255)
    text: str = Field(..., min_length=1, max_length=50_000)
    doc_type: DocType
    source: str = Field(..., min_length=1)
    category: str | None = None
    district: str | None = None  # raw surface form — canonicalized in the service (§2.6)
    ttl_days: int | None = Field(None, ge=1, le=365)

    @model_validator(mode="after")
    def _ttl_required_for_news(self) -> IngestRequest:
        """ttl_days is required when doc_type='news', ignored for 'instruction' (§3.1)."""
        if self.doc_type is DocType.NEWS and self.ttl_days is None:
            raise ValueError("ttl_days is required when doc_type is 'news'")
        return self


class IngestResponse(BaseModel):
    status: Literal["ingested", "duplicate"]
    document_id: str
    chunks_processed: int
