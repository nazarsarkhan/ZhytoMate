"""
Purpose:   Shared schema primitives: the DocType enum (no magic strings for doc_type) and the
           ErrorEnvelope returned by every error handler (§3.3).
Layer:     schema
May import:   stdlib, pydantic
Must NOT import:  api/*, services/*, components/*, domain/*; any I/O or model lib (asyncpg, google-genai, sentence-transformers, FastAPI routing)
"""
from __future__ import annotations

from enum import Enum

from pydantic import BaseModel


class DocType(str, Enum):
    """Knowledge-base document kind. Mirrors the `doc_type` CHECK constraint in 0001_init.sql."""

    NEWS = "news"
    INSTRUCTION = "instruction"


class QueryRoute(str, Enum):
    """R2RAG routing decision (ADR-010). Lives here so schemas and the domain classifier share it
    without schemas importing domain (re-exported from app.domain.classifier for callers)."""

    SIMPLE = "SIMPLE"
    COMPLEX = "COMPLEX"


class ErrorDetail(BaseModel):
    code: str  # stable machine code, e.g. "invalid_request" | "unauthorized" | "internal_error"
    message: str
    request_id: str


class ErrorEnvelope(BaseModel):
    """Uniform error body: {"error": {"code", "message", "request_id"}} (§3.3)."""

    error: ErrorDetail
