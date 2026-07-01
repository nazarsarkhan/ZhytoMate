"""
Purpose:   Contract: golden request/response shapes for /health/live, /health/ready,
           /api/v1/chat/query, /api/v1/knowledge/ingest, /api/v1/vision/analyze; the
           {"error": {"code","message","request_id"}} envelope on 401/400/429; the real
           Postgres-backed rate limiter tripping 429 on /api/v1/chat/query; and X-Request-ID
           accept/echo at the HTTP boundary.

           Verified against the codes this service actually returns, not the stub's original
           aspirational "400/401/413/415/422/303/429/503" list:
             - 422 never leaves this service: app.errors._validation_error_handler unconditionally
               maps every RequestValidationError (missing field, bad enum, a failed field/model
               validator) to 400 invalid_request, overriding FastAPI's default 422.
             - 413 doesn't exist as a distinct code: the vision schema's decoded-size cap is a
               pydantic field_validator, so an oversized image is just another
               RequestValidationError -> 400, the same as any other bad field.
             - 415 doesn't exist either: the mime_type allowlist is enforced the same way (a
               field_validator raising ValueError) -> 400, not a dedicated unsupported-media-type
               response.
             - 303 corresponds to nothing anywhere in app/* — no redirect is ever issued.
             - 503 IS real, but only from /health/ready (db/embedder absent) — and its body is the
               plain {"status": "..."} shape, not the {"error": {...}} envelope other codes use.
Layer:     test
May import:   pytest, httpx, app.config, tests.conftest (test_app/client/TEST_INTERNAL_TOKEN),
              tests.fakes/*
Must NOT import:  real openai (fakes wired through tests.conftest)
"""
from __future__ import annotations

import base64
import json

import pytest

from app.config import Settings
from tests.conftest import TEST_INTERNAL_TOKEN
from tests.fakes.fake_generator import FakeGenerator

pytestmark = pytest.mark.asyncio(loop_scope="session")

AUTH = {"X-Internal-Token": TEST_INTERNAL_TOKEN}
_VALID_JPEG_B64 = base64.b64encode(b"\xff\xd8\xff\xe0\x00\x10JFIF fake jpeg payload").decode()


# ---------------------------------------------------------------------------
# Golden success shapes
# ---------------------------------------------------------------------------

async def test_health_live_returns_ok(client) -> None:
    response = await client.get("/health/live")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


async def test_health_ready_returns_ready_when_db_and_embedder_are_up(client) -> None:
    response = await client.get("/health/ready")

    assert response.status_code == 200
    assert response.json() == {"status": "ready"}


async def test_health_ready_returns_503_when_embedder_is_absent(test_app, client) -> None:
    """The one endpoint in this service that genuinely returns 503 — and with its own
    {"status": ...} body, not the {"error": {...}} envelope the other error codes use."""
    test_app.state.embedder = None

    response = await client.get("/health/ready")

    assert response.status_code == 503
    assert response.json() == {"status": "not_ready"}


async def test_ingest_golden_response_shape(client) -> None:
    response = await client.post(
        "/api/v1/knowledge/ingest",
        headers=AUTH,
        json={
            "document_id": "doc-golden-1",
            "text": "Як подати заявку на субсидію через портал Дія.",
            "doc_type": "instruction",
            "source": "http://city.zt.ua",
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "status": "ingested",
        "document_id": "doc-golden-1",
        "chunks_processed": 1,
    }


async def test_ingest_duplicate_content_returns_duplicate_status(client) -> None:
    payload = {
        "document_id": "doc-golden-dup",
        "text": "Графік вивезення сміття у Корольовському районі.",
        "doc_type": "instruction",
        "source": "http://city.zt.ua",
    }

    first = await client.post("/api/v1/knowledge/ingest", headers=AUTH, json=payload)
    second = await client.post("/api/v1/knowledge/ingest", headers=AUTH, json=payload)

    assert first.json()["status"] == "ingested"
    assert second.json() == {
        "status": "duplicate",
        "document_id": "doc-golden-dup",
        "chunks_processed": 0,
    }


async def test_query_golden_response_shape_on_an_empty_knowledge_base(client) -> None:
    """tests.conftest wires state.embedder to FakeEmbedder (all-zero vectors) so no contract test
    needs a real OpenAI call — but a zero-norm query vector makes pgvector's cosine operator return
    NaN against any real row, and NaN would fail QueryResponse.confidence's Field(ge=0, le=1). An
    empty knowledge_base sidesteps that: dense/lexical both return zero rows (nothing to compute a
    distance against), so the pipeline's no-info branch returns before any similarity math runs — a
    genuinely deterministic 200, not a contrived one. A *sourced* answer needs a real or
    DeterministicFakeEmbedder, which is out of scope for an HTTP-shape contract test.
    """
    response = await client.post(
        "/api/v1/chat/query",
        headers=AUTH,
        json={"user_query": "Коли вивезуть сміття?", "user_id": "contract-user-1"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["answer"]
    assert body["sources_used"] == []
    assert body["confidence"] == 0.0
    assert body["route"] == "SIMPLE"


async def test_vision_golden_response_shape(test_app, client) -> None:
    scripted = {
        "is_valid": True,
        "category": "pothole",
        "severity": 4,
        "title": "Яма на дорозі",
        "description": "Глибока яма на проїжджій частині вулиці.",
    }
    test_app.state.llm_client = FakeGenerator(result=(json.dumps(scripted), 0))

    response = await client.post(
        "/api/v1/vision/analyze",
        headers=AUTH,
        json={"image_base64": _VALID_JPEG_B64, "mime_type": "image/jpeg"},
    )

    assert response.status_code == 200
    assert response.json() == scripted


# ---------------------------------------------------------------------------
# 401 unauthorized — all three internal-token-protected endpoints
# ---------------------------------------------------------------------------

_PROTECTED_REQUESTS = [
    (
        "/api/v1/knowledge/ingest",
        {
            "document_id": "doc-auth-check",
            "text": "текст",
            "doc_type": "instruction",
            "source": "src",
        },
    ),
    ("/api/v1/chat/query", {"user_query": "питання", "user_id": "u1"}),
    ("/api/v1/vision/analyze", {"image_base64": _VALID_JPEG_B64, "mime_type": "image/jpeg"}),
]


@pytest.mark.parametrize("path,payload", _PROTECTED_REQUESTS)
async def test_missing_token_is_rejected_with_401(client, path, payload) -> None:
    response = await client.post(path, json=payload)

    assert response.status_code == 401
    body = response.json()
    assert body["error"]["code"] == "unauthorized"
    assert body["error"]["request_id"]


@pytest.mark.parametrize("path,payload", _PROTECTED_REQUESTS)
async def test_wrong_token_is_rejected_with_401(client, path, payload) -> None:
    response = await client.post(
        path, headers={"X-Internal-Token": "not-the-right-token"}, json=payload
    )

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthorized"


# ---------------------------------------------------------------------------
# 400 invalid_request — a pydantic validation failure per schema
# ---------------------------------------------------------------------------

async def test_ingest_news_without_ttl_days_is_400(client) -> None:
    response = await client.post(
        "/api/v1/knowledge/ingest",
        headers=AUTH,
        json={
            "document_id": "doc-bad-news",
            "text": "Новина без ttl_days.",
            "doc_type": "news",
            "source": "src",
            # ttl_days intentionally omitted — required whenever doc_type is "news".
        },
    )

    assert response.status_code == 400
    body = response.json()
    assert body["error"]["code"] == "invalid_request"
    assert "ttl_days" in body["error"]["message"]
    assert body["error"]["request_id"]


async def test_vision_disallowed_mime_type_is_400(client) -> None:
    response = await client.post(
        "/api/v1/vision/analyze",
        headers=AUTH,
        json={"image_base64": _VALID_JPEG_B64, "mime_type": "image/gif"},
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_request"


async def test_vision_oversized_image_is_400(client) -> None:
    oversized = base64.b64encode(b"x" * (4 * 1024 * 1024 + 1)).decode()

    response = await client.post(
        "/api/v1/vision/analyze",
        headers=AUTH,
        json={"image_base64": oversized, "mime_type": "image/png"},
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_request"


async def test_vision_invalid_base64_is_400(client) -> None:
    response = await client.post(
        "/api/v1/vision/analyze",
        headers=AUTH,
        json={"image_base64": "!!! not base64 !!!", "mime_type": "image/png"},
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_request"


# ---------------------------------------------------------------------------
# 429 rate_limited — the real Postgres-backed limiter, driven over its limit
# ---------------------------------------------------------------------------

async def test_query_rate_limit_returns_429_once_exceeded(test_app, client) -> None:
    test_app.state.settings = Settings(
        database_url="postgresql://unused/unused",
        openai_api_key="unused",
        internal_token=TEST_INTERNAL_TOKEN,
        rate_limit_per_minute=2,
    )
    payload = {"user_query": "Скільки коштує проїзд?", "user_id": "rate-limited-user"}

    first = await client.post("/api/v1/chat/query", headers=AUTH, json=payload)
    second = await client.post("/api/v1/chat/query", headers=AUTH, json=payload)
    third = await client.post("/api/v1/chat/query", headers=AUTH, json=payload)

    assert first.status_code == 200
    assert second.status_code == 200
    assert third.status_code == 429
    body = third.json()
    assert body["error"]["code"] == "rate_limited"
    assert body["error"]["request_id"]
    assert third.headers["Retry-After"] == "60"


# ---------------------------------------------------------------------------
# X-Request-ID — accept-or-generate, echoed back on the response
# ---------------------------------------------------------------------------

async def test_request_id_is_echoed_back_when_supplied(client) -> None:
    response = await client.get("/health/live", headers={"X-Request-ID": "contract-test-rid"})

    assert response.headers["X-Request-ID"] == "contract-test-rid"


async def test_request_id_is_generated_when_absent(client) -> None:
    response = await client.get("/health/live")

    assert response.headers["X-Request-ID"]


async def test_request_id_appears_in_the_error_envelope_too(client) -> None:
    response = await client.post(
        "/api/v1/chat/query",
        headers={"X-Request-ID": "envelope-rid"},  # no X-Internal-Token -> a clean 401
        json={"user_query": "питання", "user_id": "u1"},
    )

    assert response.status_code == 401
    assert response.json()["error"]["request_id"] == "envelope-rid"
