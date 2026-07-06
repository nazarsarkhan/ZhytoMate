"""
Purpose:   Unit: RagService as router + cache owner, against a fake repository (no real Postgres).
           Two things worth locking in with a regression test: (1) a successfully GROUNDED query is
           cached, but an ungrounded (or blocked) response never is — not because it's cheap to
           recompute (an LLM call happens either way now), but because an ungrounded answer isn't
           anchored to specific KB chunks, so caching it risks serving a stale ungrounded reply for
           the rest of the TTL even after the KB picks up content that would have grounded this
           same query moments later; (2) a COMPLEX-classified query runs SimpleRAGPipeline when
           AGENT_RAG_ENABLED is off and AgentRAGPipeline when it's on, while the response's `route`
           field always reflects the classifier's real decision either way.
Layer:     test
May import:   pytest, app.services.rag_service, app.config, app.schemas/*, tests.fakes/*, stdlib
Must NOT import:  real asyncpg, real openai
"""
from __future__ import annotations

import json

import pytest

from app.components.rate_limiter import hash_user_id
from app.config import Settings
from app.errors import RateLimitedError
from app.schemas.common import QueryRoute
from app.schemas.query import QueryRequest
from app.schemas.retrieval import RetrievalResult
from app.services.rag_service import RagService
from tests.fakes.fake_embedder import FakeEmbedder
from tests.fakes.fake_generator import FakeGenerator
from tests.fakes.fake_repository import FakeKnowledgeRepository

# Word count 7 + the "і" enumeration marker -> classify_query() rule 3 (COMPLEX).
_COMPLEX_QUERY = "Коли вивезуть сміття і коли ввімкнуть світло"
_SIMPLE_QUERY = "Коли вивезуть сміття?"

# SimpleRAGPipeline.run() now calls the generator for an OPSEC safety check before anything else
# (pipeline.base.check_query_safety, fail-closed) — every FakeGenerator below that reaches
# SimpleRAGPipeline needs this as its first (or only) scripted reply, or the query gets silently
# blocked by the fail-closed default instead of exercising what the test actually means to check.
_SAFE_JSON = json.dumps({"safe": True})


def _settings(**overrides: object) -> Settings:
    defaults: dict[str, object] = {
        "database_url": "postgresql://unused/unused",
        "openai_api_key": "unused",
        "internal_token": "unused",
    }
    defaults.update(overrides)
    return Settings(**defaults)


def _hit(similarity: float) -> RetrievalResult:
    return RetrievalResult(
        id=1, text="Сміття вивозять щовівторка.", source="src", doc_type="instruction",
        district=None, similarity=similarity,
    )


async def test_successful_query_is_cached() -> None:
    repo = FakeKnowledgeRepository(dense=[_hit(0.9)], lexical=[_hit(0.9)])
    generator = FakeGenerator(results=[(_SAFE_JSON, 0), ("answer", 0)])
    service = RagService(repo, FakeEmbedder(), generator, _settings())
    request = QueryRequest(user_query=_SIMPLE_QUERY, user_id="u1")

    response = await service.query(request)

    cached = service._cache.get(request.user_query, None)
    assert cached is not None
    assert cached.answer == response.answer


async def test_ungrounded_query_is_never_cached() -> None:
    """Empty retrieval means the pipeline answers via the ungrounded/general-conversation
    fallback (a real LLM call, not a canned string) rather than refusing — but that answer still
    must not be cached, see the module docstring for why."""
    repo = FakeKnowledgeRepository(dense=[], lexical=[])
    service = RagService(repo, FakeEmbedder(), FakeGenerator(result=(_SAFE_JSON, 0)), _settings())
    request = QueryRequest(user_query=_SIMPLE_QUERY, user_id="u1")

    await service.query(request)

    assert service._cache.get(request.user_query, None) is None


async def test_blocked_query_is_never_cached() -> None:
    """Mirrors test_no_info_query_is_never_cached: a query the OPSEC gate refuses must not be
    cached either — a false-positive block on a legitimate civic question must not persist for the
    whole TTL window just because it was asked once (see rag_service.py's blocked branch)."""
    repo = FakeKnowledgeRepository(dense=[_hit(0.9)], lexical=[_hit(0.9)])
    service = RagService(
        repo, FakeEmbedder(), FakeGenerator(result=(json.dumps({"safe": False}), 0)), _settings()
    )
    request = QueryRequest(user_query=_SIMPLE_QUERY, user_id="u1")

    response = await service.query(request)

    assert service._cache.get(request.user_query, None) is None
    assert response.confidence == 0.0
    assert response.sources_used == []


async def test_complex_query_uses_simple_pipeline_when_agent_disabled() -> None:
    repo = FakeKnowledgeRepository(dense=[_hit(0.9)], lexical=[_hit(0.9)])
    generator = FakeGenerator(results=[(_SAFE_JSON, 0), ("answer", 0)])
    service = RagService(repo, FakeEmbedder(), generator, _settings(agent_rag_enabled=False))
    request = QueryRequest(user_query=_COMPLEX_QUERY, user_id="u1")

    response = await service.query(request)

    # classifier's real decision, kept for observability
    assert response.route is QueryRoute.COMPLEX
    # a safety check + a single synthesis call — no decompose, so it was SimpleRAGPipeline
    assert generator.call_count == 2


async def test_rate_limit_counter_receives_a_hashed_key_not_the_raw_user_id() -> None:
    repo = FakeKnowledgeRepository(dense=[_hit(0.9)], lexical=[_hit(0.9)])
    generator = FakeGenerator(results=[(_SAFE_JSON, 0), ("answer", 0)])
    service = RagService(repo, FakeEmbedder(), generator, _settings())
    request = QueryRequest(user_query=_SIMPLE_QUERY, user_id="u1")

    await service.query(request)

    assert len(repo.rate_limit_calls) == 1
    hashed_key, _window = repo.rate_limit_calls[0]
    assert hashed_key == hash_user_id("u1")
    assert hashed_key != "u1"


async def test_query_raises_rate_limited_error_when_denied() -> None:
    repo = FakeKnowledgeRepository(rate_limit_allowed=False)
    service = RagService(repo, FakeEmbedder(), FakeGenerator(result=("answer", 0)), _settings())
    request = QueryRequest(user_query=_SIMPLE_QUERY, user_id="u1")

    with pytest.raises(RateLimitedError):
        await service.query(request)


async def test_complex_query_uses_agent_pipeline_when_enabled() -> None:
    repo = FakeKnowledgeRepository(dense=[_hit(0.9)], lexical=[_hit(0.9)])
    decompose_json = json.dumps([_COMPLEX_QUERY])
    generator = FakeGenerator(results=[(decompose_json, 0), ("answer", 0)])
    service = RagService(repo, FakeEmbedder(), generator, _settings(agent_rag_enabled=True))
    request = QueryRequest(user_query=_COMPLEX_QUERY, user_id="u1")

    response = await service.query(request)

    assert response.route is QueryRoute.COMPLEX
    assert response.answer == "answer"
    assert generator.call_count == 2  # decompose + synthesis -> proves AgentRAGPipeline ran
