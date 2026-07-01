"""
Purpose:   Flow (AgentRAGPipeline, fake Embedder/Retriever/Generator): a multi-intent query
           decomposes into sub-queries that retrieve in parallel and merge into one synthesis call;
           when 2+ sub-queries are dry (below sim_gate), only the FIRST one (by list order) is
           rewritten and re-retried — a single shared re-query budget for the whole request, not one
           per dry sub-query. Also proves the shared tail holds through the agent path: all-empty
           retrieval => the synthesis Generator call is skipped (no-info); a Generator error at
           synthesis => the same extractive fallback as the simple path. AGENT_RAG_ENABLED
           gating/fallback-to-simple is RagService's job, not AgentRAGPipeline's — exercised here
           directly, not through the router.
Layer:     test
May import:   pytest, app.pipeline.agent, app.pipeline.base, tests.fakes.fake_generator,
              tests.fakes.fake_embedder, tests.fakes.fake_retriever, app.schemas/*, stdlib (json)
Must NOT import:  real openai; live network
"""
from __future__ import annotations

import json

from app.pipeline.agent import AgentRAGPipeline
from app.pipeline.base import RagContext
from app.schemas.common import QueryRoute
from app.schemas.retrieval import RetrievalOutcome, RetrievalResult
from tests.fakes.fake_embedder import FakeEmbedder
from tests.fakes.fake_generator import FakeGenerator
from tests.fakes.fake_retriever import FakeRetriever

_SIM_GATE = 0.70
_SIM_HIGH = 0.80

_TRASH_Q = "Коли вивезуть сміття?"
_LIGHT_Q = "Коли ввімкнуть світло?"
_WATER_Q = "Коли буде вода?"
_LIGHT_REWRITTEN = "Який графік відключень світла?"

_MULTI_QUERY = f"{_TRASH_Q} {_LIGHT_Q} {_WATER_Q}"


def _hit(chunk_id: int, similarity: float, text: str = "текст") -> RetrievalResult:
    return RetrievalResult(
        id=chunk_id, text=text, source="src", doc_type="instruction", district=None,
        similarity=similarity,
    )


def _outcome(*hits: RetrievalResult) -> RetrievalOutcome:
    return RetrievalOutcome(dense=list(hits), fused=list(hits))


def _pipeline(
    retriever: FakeRetriever, generator: FakeGenerator, max_subqueries: int = 3
) -> AgentRAGPipeline:
    return AgentRAGPipeline(
        FakeEmbedder(), retriever, generator, _SIM_GATE, _SIM_HIGH, max_subqueries
    )


async def test_all_subqueries_sufficient_synthesizes_without_any_rewrite() -> None:
    decompose_json = json.dumps([_TRASH_Q, _LIGHT_Q])
    retriever = FakeRetriever(
        {
            _TRASH_Q: _outcome(_hit(1, 0.9, "Сміття вивозять щовівторка.")),
            _LIGHT_Q: _outcome(_hit(2, 0.85, "Світло за графіком.")),
        }
    )
    generator = FakeGenerator(results=[(decompose_json, 0), ("Зведена відповідь.", 0)])
    pipeline = _pipeline(retriever, generator)

    result = await pipeline.run(
        RagContext(user_query=_MULTI_QUERY, district_slug=None, route=QueryRoute.COMPLEX)
    )

    assert generator.call_count == 2  # decompose + synthesis — no rewrite needed
    assert result.answer == "Зведена відповідь."
    call_texts = [c[0] for c in retriever.calls]
    assert call_texts.count(_TRASH_Q) == 1
    assert call_texts.count(_LIGHT_Q) == 1


async def test_only_the_first_dry_subquery_is_rewritten_and_reretried() -> None:
    decompose_json = json.dumps([_TRASH_Q, _LIGHT_Q, _WATER_Q])
    retriever = FakeRetriever(
        {
            _TRASH_Q: _outcome(_hit(1, 0.9, "Сміття вивозять щовівторка.")),
            _LIGHT_Q: _outcome(_hit(2, 0.2, "нерелевантно")),      # dry — first dry, by list order
            _WATER_Q: _outcome(_hit(3, 0.1, "теж нерелевантно")),  # dry — second dry, must stay dry
            _LIGHT_REWRITTEN: _outcome(_hit(4, 0.95, "Графік відключень: 10:00-14:00.")),
        }
    )
    generator = FakeGenerator(
        results=[(decompose_json, 0), (_LIGHT_REWRITTEN, 0), ("Зведена відповідь.", 0)]
    )
    pipeline = _pipeline(retriever, generator)

    result = await pipeline.run(
        RagContext(user_query=_MULTI_QUERY, district_slug=None, route=QueryRoute.COMPLEX)
    )

    # decompose (1) + exactly ONE rewrite (1) + synthesis (1) — never one rewrite per dry sub-query.
    assert generator.call_count == 3
    call_texts = [c[0] for c in retriever.calls]
    assert call_texts.count(_TRASH_Q) == 1
    assert call_texts.count(_LIGHT_Q) == 1           # the initial (dry) retrieve for the rewritten one
    assert call_texts.count(_WATER_Q) == 1           # still only retrieved once — never rewritten
    assert call_texts.count(_LIGHT_REWRITTEN) == 1   # the single shared re-query budget was spent here
    assert len(retriever.calls) == 4
    assert result.answer == "Зведена відповідь."
    assert result.confidence == 0.95  # max dense top-1 across sub-queries (rewritten світло wins)


async def test_all_subqueries_dry_returns_no_info_without_synthesis_call() -> None:
    decompose_json = json.dumps([_TRASH_Q])
    retriever = FakeRetriever({})  # every query_text is un-scripted -> empty outcome
    generator = FakeGenerator(results=[(decompose_json, 0), ("рерайт", 0)])
    pipeline = _pipeline(retriever, generator)

    result = await pipeline.run(
        RagContext(user_query=_TRASH_Q, district_slug=None, route=QueryRoute.SIMPLE)
    )

    # decompose + the single shared rewrite attempt both happen; synthesis never runs (no-info gate).
    assert generator.call_count == 2
    assert result.debug["no_info"] is True
    assert result.sources_used == []


async def test_synthesis_generator_error_degrades_to_extractive_fallback() -> None:
    decompose_json = json.dumps([_TRASH_Q])
    hit_text = "Сміття вивозять щовівторка."
    retriever = FakeRetriever({_TRASH_Q: _outcome(_hit(1, 0.9, hit_text))})
    generator = FakeGenerator(results=[(decompose_json, 0)], error=RuntimeError("boom"))
    pipeline = _pipeline(retriever, generator)

    result = await pipeline.run(
        RagContext(user_query=_TRASH_Q, district_slug=None, route=QueryRoute.SIMPLE)
    )

    assert generator.call_count == 2  # decompose succeeds, synthesis raises
    assert result.answer == f"За наявними даними: {hit_text}"
    assert result.confidence == 0.5
    assert result.debug["llm_ok"] is False
