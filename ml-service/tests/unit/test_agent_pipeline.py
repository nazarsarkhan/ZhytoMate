"""
Purpose:   Unit: AgentRAGPipeline._decompose/_rewrite parsing and fallback behavior, plus the two
           module-level pure helpers _interleave_by_rank (round-robin merge of per-sub-query fused
           lists) and _outcome_or_dry (a failed sub-query retrieval degrades to an empty outcome
           instead of propagating). A valid JSON array becomes the sub-query list (capped at
           max_subqueries, whitespace-stripped, blanks dropped); malformed JSON, non-list JSON, a
           list with a non-string element, an empty list, or an all-blank list all degrade to
           [query] rather than raising. _rewrite returns the model's stripped text on success, or
           the original sub-query unchanged on any failure or an empty-after-strip reply.
Layer:     test
May import:   pytest, app.pipeline.agent, app.schemas.retrieval, tests.fakes.fake_generator,
              tests.fakes.fake_embedder, tests.fakes.fake_retriever
Must NOT import:  real openai, real asyncpg (injected fakes only)
"""
from __future__ import annotations

from app.pipeline.agent import AgentRAGPipeline, _interleave_by_rank, _outcome_or_dry
from app.pipeline.base import RETRIEVE_LIMIT
from app.schemas.retrieval import RetrievalOutcome, RetrievalResult
from tests.fakes.fake_embedder import FakeEmbedder
from tests.fakes.fake_generator import FakeGenerator
from tests.fakes.fake_retriever import FakeRetriever

_QUERY = "Коли вивезуть сміття і коли ввімкнуть світло?"


def _hit(chunk_id: int) -> RetrievalResult:
    return RetrievalResult(
        id=chunk_id, text="текст", source="src", doc_type="instruction", district=None,
        similarity=0.9,
    )


def _pipeline(generator: FakeGenerator, max_subqueries: int = 3) -> AgentRAGPipeline:
    return AgentRAGPipeline(
        FakeEmbedder(), FakeRetriever({}), generator, 0.70, 0.80, max_subqueries
    )


async def test_decompose_parses_valid_json_array() -> None:
    generator = FakeGenerator(result=('["Коли вивезуть сміття?", "Коли ввімкнуть світло?"]', 0))
    subqueries = await _pipeline(generator)._decompose(_QUERY)
    assert subqueries == ["Коли вивезуть сміття?", "Коли ввімкнуть світло?"]


async def test_decompose_falls_back_to_query_on_malformed_json() -> None:
    generator = FakeGenerator(result=("not json at all {[", 0))
    subqueries = await _pipeline(generator)._decompose(_QUERY)
    assert subqueries == [_QUERY]


async def test_decompose_falls_back_to_query_on_non_list_json() -> None:
    generator = FakeGenerator(result=('{"sub": "queries"}', 0))
    subqueries = await _pipeline(generator)._decompose(_QUERY)
    assert subqueries == [_QUERY]


async def test_decompose_falls_back_to_query_on_non_string_element() -> None:
    generator = FakeGenerator(result=('["one", 2, "three"]', 0))
    subqueries = await _pipeline(generator)._decompose(_QUERY)
    assert subqueries == [_QUERY]


async def test_decompose_falls_back_to_query_on_empty_list() -> None:
    generator = FakeGenerator(result=("[]", 0))
    subqueries = await _pipeline(generator)._decompose(_QUERY)
    assert subqueries == [_QUERY]


async def test_decompose_drops_blank_strings_but_keeps_real_ones() -> None:
    generator = FakeGenerator(result=('["", "  ", "Коли вивезуть сміття?"]', 0))
    subqueries = await _pipeline(generator)._decompose(_QUERY)
    assert subqueries == ["Коли вивезуть сміття?"]


async def test_decompose_falls_back_to_query_when_all_entries_are_blank() -> None:
    generator = FakeGenerator(result=('["", "   "]', 0))
    subqueries = await _pipeline(generator)._decompose(_QUERY)
    assert subqueries == [_QUERY]


async def test_decompose_caps_at_max_subqueries() -> None:
    generator = FakeGenerator(result=('["a", "b", "c", "d", "e"]', 0))
    subqueries = await _pipeline(generator, max_subqueries=2)._decompose(_QUERY)
    assert subqueries == ["a", "b"]


async def test_decompose_falls_back_to_query_on_generator_error() -> None:
    generator = FakeGenerator(error=RuntimeError("boom"))
    subqueries = await _pipeline(generator)._decompose(_QUERY)
    assert subqueries == [_QUERY]


async def test_rewrite_returns_stripped_model_text_on_success() -> None:
    generator = FakeGenerator(result=("  Коли саме вивезуть сміття цього тижня?  ", 0))
    rewritten = await _pipeline(generator)._rewrite("Коли сміття?")
    assert rewritten == "Коли саме вивезуть сміття цього тижня?"


async def test_rewrite_keeps_original_on_generator_error() -> None:
    generator = FakeGenerator(error=RuntimeError("boom"))
    rewritten = await _pipeline(generator)._rewrite("Коли сміття?")
    assert rewritten == "Коли сміття?"


async def test_rewrite_keeps_original_when_model_returns_blank() -> None:
    generator = FakeGenerator(result=("   ", 0))
    rewritten = await _pipeline(generator)._rewrite("Коли сміття?")
    assert rewritten == "Коли сміття?"


def test_interleave_by_rank_takes_rank_zero_from_every_outcome_before_rank_one() -> None:
    outcome_a = RetrievalOutcome(dense=[], fused=[_hit(1), _hit(2), _hit(3)])
    outcome_b = RetrievalOutcome(dense=[], fused=[_hit(4)])

    interleaved = _interleave_by_rank([outcome_a, outcome_b])

    # rank 0 of both outcomes first (1, 4), then rank 1 of A (2) — B has no rank 1 to contribute —
    # then rank 2 of A (3). B's only chunk is never starved out by A's lower-ranked chunks.
    assert [chunk.id for chunk in interleaved] == [1, 4, 2, 3]


def test_interleave_by_rank_returns_empty_list_for_no_outcomes() -> None:
    assert _interleave_by_rank([]) == []


def test_interleave_by_rank_handles_an_outcome_with_no_fused_hits() -> None:
    outcome_a = RetrievalOutcome(dense=[], fused=[_hit(1)])
    outcome_b = RetrievalOutcome(dense=[], fused=[])  # e.g. a dry or failed sub-query

    interleaved = _interleave_by_rank([outcome_a, outcome_b])

    assert [chunk.id for chunk in interleaved] == [1]


def test_outcome_or_dry_passes_a_successful_outcome_through_unchanged() -> None:
    outcome = RetrievalOutcome(dense=[_hit(1)], fused=[_hit(1)])
    assert _outcome_or_dry("сміття", outcome) is outcome


def test_outcome_or_dry_converts_an_exception_to_an_empty_outcome() -> None:
    result = _outcome_or_dry("сміття", RuntimeError("connection reset"))
    assert result == RetrievalOutcome(dense=[], fused=[])


def test_outcome_or_dry_logs_a_warning_naming_the_subquery_and_exception_type(caplog) -> None:
    with caplog.at_level("WARNING"):
        _outcome_or_dry("Коли вивезуть сміття?", RuntimeError("connection reset"))
    assert "Коли вивезуть сміття?" in caplog.text
    assert "RuntimeError" in caplog.text


async def test_reretry_dry_keeps_original_outcome_when_the_retry_itself_fails(caplog) -> None:
    rewritten_query = "Коли вивезуть сміття цього тижня?"
    generator = FakeGenerator(result=(rewritten_query, 0))
    retriever = FakeRetriever({rewritten_query: RuntimeError("connection reset")})
    pipeline = AgentRAGPipeline(FakeEmbedder(), retriever, generator, 0.70, 0.80, 3)
    original = RetrievalOutcome(dense=[], fused=[])

    with caplog.at_level("WARNING"):
        result = await pipeline._reretry_dry("Коли сміття?", original, district=None)

    # The retry itself raised — _reretry_dry must swallow it and hand back the sub-query's
    # original (already-dry) outcome rather than letting the whole request 500.
    assert result is original
    assert retriever.calls == [(rewritten_query, None, RETRIEVE_LIMIT)]
    assert "RuntimeError" in caplog.text
