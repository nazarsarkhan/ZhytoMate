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
May import:   pytest, httpx, app.config, app.schemas.retrieval, app.services.rag_service,
              tests.conftest (test_app/client/TEST_INTERNAL_TOKEN), tests.fakes/*
Must NOT import:  real openai (fakes wired through tests.conftest)
"""
from __future__ import annotations

import base64
import json

import pytest

from app.config import Settings
from app.schemas.retrieval import RetrievalResult
from app.services.rag_service import RagService
from tests.conftest import TEST_INTERNAL_TOKEN
from tests.fakes.fake_generator import FakeGenerator
from tests.fakes.fake_repository import FakeKnowledgeRepository

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


async def test_health_deps_uses_llm_probe_contract(test_app, client) -> None:
    class ProbeableLLM:
        async def probe(self) -> None:
            return None

    test_app.state.llm_client = ProbeableLLM()

    response = await client.get("/health/deps")

    assert response.status_code == 200
    assert response.json()["openai"] == "ok"


async def test_ingest_golden_response_shape(client) -> None:
    response = await client.post(
        "/api/v1/knowledge/ingest",
        headers=AUTH,
        json={
            "document_id": "doc-golden-1",
            "text": "Як подати заявку на субсидію через портал Дія.",
            "doc_type": "document",
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
    assert body["grounded"] is False
    assert body["verified"] is False
    assert body["answer_status"] == "ungrounded"
    assert body["app_links"] == []


async def test_query_returns_a_verified_internal_link_for_an_app_capability(client) -> None:
    response = await client.post(
        "/api/v1/chat/query",
        headers=AUTH,
        json={"user_query": "Де подивитися маршрути та тролейбуси?", "user_id": "app-link-user"},
    )

    assert response.status_code == 200
    assert response.json()["app_links"][0]["route"] == "/services/transport"


async def test_query_response_includes_action_intent_field(client) -> None:
    response = await client.post(
        "/api/v1/chat/query",
        headers=AUTH,
        json={"user_query": "Коли вивезуть сміття?", "user_id": "contract-user-2"},
    )

    assert response.status_code == 200
    body = response.json()
    assert "action_intent" in body
    assert body["action_intent"] is None


async def test_query_response_carries_a_real_action_intent_value(test_app, client) -> None:
    """The test above only proves the field EXISTS and defaults to None — which is also what
    QueryResponse's own pydantic default produces even if rag_service.py's
    `action_intent=result.action_intent` wiring were deleted outright. This test scripts a
    safety-check reply carrying a REAL action_intent so only the actual wiring, not the field's
    default, can make it pass — mirrors test_query_answer_cache_persists_across_separate_requests's
    pattern of rebuilding state.rag_service with a custom generator to get a specific scripted
    reply through the real HTTP stack."""
    action_json = json.dumps(
        {"safe": True, "conversational": False, "action_intent": "create_appeal"}
    )
    generator = FakeGenerator(
        results=[(action_json, 0), ("Гаразд, зберемо деталі про звернення.", 0)]
    )
    test_app.state.llm_client = generator
    test_app.state.rag_service = RagService(
        repo=test_app.state.repo,
        embedder=test_app.state.embedder,
        generator=generator,
        settings=test_app.state.settings,
    )

    response = await client.post(
        "/api/v1/chat/query",
        headers=AUTH,
        json={
            "user_query": "Хочу подати звернення про яму на дорозі",
            "user_id": "contract-user-action",
        },
    )

    assert response.status_code == 200
    assert response.json()["action_intent"] == "create_appeal"


async def test_query_answer_cache_persists_across_separate_requests(test_app, client) -> None:
    """Regression test for the bug where app.deps.get_rag_service built a brand-new RagService (and
    therefore a brand-new, empty answer cache) on every call — FastAPI invokes a
    Depends(get_rag_service) factory fresh for every incoming request, so the cache could never
    survive from one request to the next. This has to go through two separate `client.post` calls
    (two separate HTTP requests, each resolving get_rag_service independently) to exercise that
    path; a unit test that builds one RagService and calls `.query()` on it twice — like
    tests/unit/test_rag_service.py's cache tests — never touches app.deps at all and would not have
    caught this.

    Retrieval is stubbed via a FakeKnowledgeRepository (rather than ingesting into the real
    Postgres-backed `state.repo` through FakeEmbedder's all-zero vectors) so the dense leg returns a
    real, non-zero similarity instead of the zero-norm-vector NaN described in
    test_query_golden_response_shape_on_an_empty_knowledge_base above. `state.repo` and
    `state.llm_client` are overridden too (not just `state.rag_service`) so that a would-be-buggy
    get_rag_service that rebuilds RagService from those pieces on every call sees the same
    retrievable content and the same generator as the shared instance does — otherwise a mutation
    test against the old build-fresh-every-call code would fail for the wrong reason (an empty real
    repo -> no-info gate) instead of the actual bug (a second, uncached LLM call).
    """
    hit = RetrievalResult(
        id=1, text="Сміття вивозять щовівторка.", source="src", doc_type="instruction",
        district=None, similarity=0.9,
    )
    # Two scripted calls for the ONE pipeline run the cache should allow: the leading OPSEC safety
    # check (pipeline.base.check_query_safety), then the actual answer generation. The query is
    # Ukrainian, so detect_and_translate is skipped (no LLM call) — see is_ukrainian.
    safe_json = json.dumps({"safe": True})
    generator = FakeGenerator(results=[(safe_json, 0), ("Сміття вивозять щовівторка.", 0)])
    fake_repo = FakeKnowledgeRepository(dense=[hit], lexical=[hit])
    test_app.state.repo = fake_repo
    test_app.state.llm_client = generator
    test_app.state.rag_service = RagService(
        repo=fake_repo,
        embedder=test_app.state.embedder,
        generator=generator,
        settings=test_app.state.settings,
    )
    payload = {"user_query": "Коли вивезуть сміття?", "user_id": "cache-contract-user"}

    first = await client.post("/api/v1/chat/query", headers=AUTH, json=payload)
    second = await client.post("/api/v1/chat/query", headers=AUTH, json=payload)

    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json()["answer"] == first.json()["answer"]
    # The first request costs 2 LLM calls (safety check + answer generation); a cache hit on the
    # second skips pipeline.run() entirely, so a THIRD call would mean the second request built its
    # own fresh, empty cache instead of reusing the RagService (and its cache) built once above.
    assert generator.call_count == 2


async def test_extract_slots_endpoint_returns_the_contract_shape(client) -> None:
    """Contract-level shape check only — tests.conftest's default test_app fixture scripts a
    generator reply for the safety-check JSON contract, not this endpoint's {"slots", ...} shape,
    so this specific call falls through ActionService's fail-closed path (is_unrelated=True,
    current_slots preserved unchanged — here, empty). Richer extraction/merge behavior is
    unit-tested against a purpose-scripted FakeGenerator in tests/unit/test_action_service.py —
    this test only proves the HTTP contract (status code, response keys) end-to-end through the
    real FastAPI route."""
    response = await client.post(
        "/api/v1/assistant/extract-slots",
        headers=AUTH,
        json={
            "message": "Величезна яма на вул. Київській",
            "slot_schema": [
                {
                    "name": "category",
                    "description": "Категорія проблеми",
                    "enum_values": ["pothole", "garbage"],
                },
                {"name": "address", "description": "Адреса"},
            ],
            "current_slots": {},
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["slots"] == {}
    assert body["wants_cancel"] is False
    assert body["is_unrelated"] is True


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
    # RagService reads rate_limit_per_minute off the settings object it was constructed with, not
    # off app.state at request time (the same way real Settings are process-lifetime-fixed behind
    # get_settings()'s lru_cache) — so overriding state.settings alone no longer reaches it now that
    # RagService is built once instead of per-request. Rebuild it here to pick up the new settings.
    test_app.state.rag_service = RagService(
        repo=test_app.state.repo,
        embedder=test_app.state.embedder,
        generator=test_app.state.llm_client,
        settings=test_app.state.settings,
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
