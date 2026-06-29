"""
Purpose:   FastAPI dependencies: the X-Internal-Token auth guard (constant-time) + service factories
           built from app.state (pool/embedder/settings wired in the lifespan). Concrete service +
           repository classes are imported inside the factory bodies to avoid import cycles.
Layer:     api
May import:   FastAPI, app.config, app.errors, services/* + components/* (inside factory bodies)
Must NOT import:  api/v1/* routers (avoid cycles); domain/* directly; the hosted-LLM SDK, asyncpg, sentence-transformers
"""
from __future__ import annotations

import hmac
from typing import TYPE_CHECKING

from fastapi import Request

from app.errors import UnauthorizedError

if TYPE_CHECKING:
    from app.services.ingest_service import IngestService

_INTERNAL_TOKEN_HEADER = "X-Internal-Token"


def verify_internal_token(request: Request) -> None:
    """Constant-time compare of X-Internal-Token vs settings.internal_token; 401 on miss/mismatch."""
    expected = request.app.state.settings.internal_token
    provided = request.headers.get(_INTERNAL_TOKEN_HEADER)
    if provided is None or not hmac.compare_digest(provided, expected):
        raise UnauthorizedError("Missing or invalid internal token")


def get_ingest_service(request: Request) -> "IngestService":
    """Build IngestService from app.state. Imported here (not at module top) to dodge import cycles."""
    from app.services.ingest_service import IngestService

    state = request.app.state
    return IngestService(repo=state.repo, embedder=state.embedder, settings=state.settings)
