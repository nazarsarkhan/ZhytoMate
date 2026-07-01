"""
Purpose:   Flow (SimpleRAGPipeline, fake Embedder/Retriever/Generator): empty retrieval => Generator
           NOT called (no-info path); a sufficiently similar retrieval => Generator IS called and its
           answer is returned; a Generator error => extractive fallback (the top chunk's text,
           prefixed) instead of a 5xx. Exercises the pipeline directly (not RagService, which also
           owns rate-limiting/caching against a real repo — out of scope for this fast, DB-free flow).
Layer:     test
May import:   pytest, app.pipeline.simple, app.pipeline.base, tests.fakes.fake_generator,
              tests.fakes.fake_embedder, tests.fakes.fake_retriever, app.schemas/*
Must NOT import:  real openai, real asyncpg (injected fakes only)
"""
from __future__ import annotations

from app.pipeline.base import RagContext
from app.pipeline.simple import SimpleRAGPipeline
from app.schemas.common import QueryRoute
from app.schemas.retrieval import RetrievalOutcome, RetrievalResult
from tests.fakes.fake_embedder import FakeEmbedder
from tests.fakes.fake_generator import FakeGenerator
from tests.fakes.fake_retriever import FakeRetriever

_SIM_GATE = 0.70
_SIM_HIGH = 0.80
_QUERY = "Коли вивезуть сміття?"


def _hit(chunk_id: int, similarity: float, text: str) -> RetrievalResult:
    return RetrievalResult(
        id=chunk_id, text=text, source="src", doc_type="instruction", district=None,
        similarity=similarity,
    )


def _pipeline(retriever: FakeRetriever, generator: FakeGenerator) -> SimpleRAGPipeline:
    return SimpleRAGPipeline(FakeEmbedder(), retriever, generator, _SIM_GATE, _SIM_HIGH)


async def test_empty_retrieval_returns_no_info_without_calling_generator() -> None:
    retriever = FakeRetriever({_QUERY: RetrievalOutcome(dense=[], fused=[])})
    generator = FakeGenerator()
    pipeline = _pipeline(retriever, generator)

    result = await pipeline.run(
        RagContext(user_query=_QUERY, district_slug=None, route=QueryRoute.SIMPLE)
    )

    assert generator.call_count == 0
    assert result.confidence == 0.0
    assert result.sources_used == []
    assert result.debug["no_info"] is True


async def test_sufficient_retrieval_calls_generator_and_returns_its_answer() -> None:
    hit = _hit(1, similarity=0.9, text="Сміття вивозять щовівторка.")
    retriever = FakeRetriever({_QUERY: RetrievalOutcome(dense=[hit], fused=[hit])})
    generator = FakeGenerator(result=("Сміття вивозять щовівторка.", 0))
    pipeline = _pipeline(retriever, generator)

    result = await pipeline.run(
        RagContext(user_query=_QUERY, district_slug=None, route=QueryRoute.SIMPLE)
    )

    assert generator.call_count == 1
    assert result.answer == "Сміття вивозять щовівторка."
    assert result.confidence == 0.9
    assert len(result.sources_used) == 1
    assert result.debug["no_info"] is False


async def test_generator_error_degrades_to_extractive_fallback() -> None:
    hit_text = "Сміття вивозять щовівторка."
    hit = _hit(1, similarity=0.9, text=hit_text)
    retriever = FakeRetriever({_QUERY: RetrievalOutcome(dense=[hit], fused=[hit])})
    generator = FakeGenerator(error=RuntimeError("boom"))
    pipeline = _pipeline(retriever, generator)

    result = await pipeline.run(
        RagContext(user_query=_QUERY, district_slug=None, route=QueryRoute.SIMPLE)
    )

    assert generator.call_count == 1
    assert result.answer == f"За наявними даними: {hit_text}"
    assert result.confidence == 0.5
    assert result.debug["llm_ok"] is False
