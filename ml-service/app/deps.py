"""
Purpose:   FastAPI dependencies: the X-Internal-Token auth guard (constant-time) + service factories
           built from app.state (pool/embedder/settings wired in the lifespan). get_action_service,
           get_ingest_service, and get_vision_service build a fresh, stateless service on every
           call; get_rag_service is the one exception — it returns the single RagService built once
           in app.main's lifespan, because RagService owns the answer cache as internal state and a
           fresh instance per request would never let a cached answer survive to a later request.
           Concrete service + repository classes for the per-request factories are imported inside
           their bodies to avoid import cycles.
Layer:     api
May import:   FastAPI, app.config, app.errors, services/* + components/* (inside factory bodies)
Must NOT import:  api/v1/* routers (avoid cycles); domain/* directly; the hosted-LLM SDK, asyncpg
"""
from __future__ import annotations

import hmac
from typing import TYPE_CHECKING

from fastapi import Request

from app.errors import UnauthorizedError

if TYPE_CHECKING:
    from app.services.action_service import ActionService
    from app.services.ingest_service import IngestService
    from app.services.rag_service import RagService
    from app.services.vision_service import VisionService

_INTERNAL_TOKEN_HEADER = "X-Internal-Token"


def verify_internal_token(request: Request) -> None:
    """Constant-time compare of X-Internal-Token vs settings.internal_token; 401 on
    miss/mismatch."""
    expected = request.app.state.settings.internal_token
    provided = request.headers.get(_INTERNAL_TOKEN_HEADER)
    if provided is None or not hmac.compare_digest(provided, expected):
        raise UnauthorizedError("Missing or invalid internal token")


def get_action_service(request: Request) -> ActionService:
    """Build ActionService from app.state. Imported here (not at module top) to dodge import
    cycles."""
    from app.services.action_service import ActionService

    return ActionService(generator=request.app.state.llm_client)


def get_ingest_service(request: Request) -> IngestService:
    """Build IngestService from app.state. Imported here (not at module top) to dodge import
    cycles."""
    from app.services.ingest_service import IngestService

    state = request.app.state
    return IngestService(repo=state.repo, embedder=state.embedder, settings=state.settings)


def get_rag_service(request: Request) -> RagService:
    """Return the single RagService instance built once in app.main's lifespan and stored on
    app.state, rather than constructing a new one per call like get_ingest_service/
    get_vision_service do. RagService owns the answer cache (_AnswerCache) as internal state, and
    FastAPI invokes a Depends(get_rag_service) factory fresh on every incoming request — building a
    brand-new RagService here meant a brand-new, empty cache per request, discarded the moment the
    request finished, so the answer cache could never produce a hit in real traffic. Reading the
    shared instance off app.state instead fixes that: the cache now lives for the process's
    lifetime, not a single request's."""
    return request.app.state.rag_service


def get_vision_service(request: Request) -> VisionService:
    """Build VisionService from app.state. Imported here (not at module top) to dodge import
    cycles."""
    from app.services.vision_service import VisionService

    state = request.app.state
    return VisionService(generator=state.llm_client, settings=state.settings)
