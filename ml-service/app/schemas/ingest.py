"""
Purpose:   IngestRequest / IngestResponse models for POST /api/v1/knowledge/ingest, including the
           ttl_days-required-when-news cross-field rule (§3.1). Validation lives here, not in the
           service or router.
Layer:     schema
May import:   stdlib, pydantic, schemas/common (DocType)
Must NOT import:  api/*, services/*, components/*, domain/*; any I/O or model lib (asyncpg, FastAPI
              routing)
"""
from __future__ import annotations

from datetime import datetime
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
    # Publication time. News expiry is anchored to this (published_at + ttl_days) so it stays
    # deterministic across re-ingests and correct for backfilled items; when absent it falls back
    # to ingest time (§2.5). Ignored for instructions.
    published_at: datetime | None = None

    @model_validator(mode="after")
    def _ttl_required_for_news(self) -> IngestRequest:
        """ttl_days is required when doc_type='news', ignored for 'instruction' (§3.1)."""
        if self.doc_type is DocType.NEWS and self.ttl_days is None:
            raise ValueError("ttl_days is required when doc_type is 'news'")
        return self


class IngestResponse(BaseModel):
    status: Literal["ingested", "duplicate", "expired"]
    document_id: str
    chunks_processed: int


class DeleteResponse(BaseModel):
    document_id: str
    chunks_deleted: int
