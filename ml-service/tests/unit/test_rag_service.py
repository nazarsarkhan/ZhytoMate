"""
Purpose:   Unit: RagService as router + cache owner, against a fake repository (no real Postgres).
           Two things worth locking in with a regression test: (1) a successfully-answered query is
           cached, but a no-info response never is — a no-info result is cheap to recompute (no LLM
           call happened) and caching it for the TTL window would risk serving a stale "no info"
           once the KB picks up new content; (2) a COMPLEX-classified query runs SimpleRAGPipeline
           when AGENT_RAG_ENABLED is off and AgentRAGPipeline when it's on, while the response's
           `route` field always reflects the classifier's real decision either way.
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
    service = RagService(repo, FakeEmbedder(), FakeGenerator(result=("answer", 0)), _settings())
    request = QueryRequest(user_query=_SIMPLE_QUERY, user_id="u1")

    response = await service.query(request)

    cached = service._cache.get(request.user_query, None)
    assert cached is not None
    assert cached.answer == response.answer


async def test_no_info_query_is_never_cached() -> None:
    repo = FakeKnowledgeRepository(dense=[], lexical=[])
    service = RagService(repo, FakeEmbedder(), FakeGenerator(), _settings())
    request = QueryRequest(user_query=_SIMPLE_QUERY, user_id="u1")

    await service.query(request)

    assert service._cache.get(request.user_query, None) is None


async def test_complex_query_uses_simple_pipeline_when_agent_disabled() -> None:
    repo = FakeKnowledgeRepository(dense=[_hit(0.9)], lexical=[_hit(0.9)])
    generator = FakeGenerator(result=("answer", 0))
    service = RagService(repo, FakeEmbedder(), generator, _settings(agent_rag_enabled=False))
    request = QueryRequest(user_query=_COMPLEX_QUERY, user_id="u1")

    response = await service.query(request)

    # classifier's real decision, kept for observability
    assert response.route is QueryRoute.COMPLEX
    # a single synthesis call — no decompose, so it was SimpleRAGPipeline
    assert generator.call_count == 1


async def test_rate_limit_counter_receives_a_hashed_key_not_the_raw_user_id() -> None:
    repo = FakeKnowledgeRepository(dense=[_hit(0.9)], lexical=[_hit(0.9)])
    service = RagService(repo, FakeEmbedder(), FakeGenerator(result=("answer", 0)), _settings())
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
