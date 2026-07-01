"""
Purpose:   Unit: AgentRAGPipeline._decompose/_rewrite parsing and fallback behavior. A valid JSON
           array becomes the sub-query list (capped at max_subqueries, whitespace-stripped, blanks
           dropped); malformed JSON, non-list JSON, a list with a non-string element, an empty list,
           or an all-blank list all degrade to [query] rather than raising. _rewrite returns the
           model's stripped text on success, or the original sub-query unchanged on any failure or
           an empty-after-strip reply.
Layer:     test
May import:   pytest, app.pipeline.agent, tests.fakes.fake_generator, tests.fakes.fake_embedder,
              tests.fakes.fake_retriever
Must NOT import:  real openai, real asyncpg (injected fakes only)
"""
from __future__ import annotations

from app.pipeline.agent import AgentRAGPipeline
from tests.fakes.fake_embedder import FakeEmbedder
from tests.fakes.fake_generator import FakeGenerator
from tests.fakes.fake_retriever import FakeRetriever

_QUERY = "Коли вивезуть сміття і коли ввімкнуть світло?"


def _pipeline(generator: FakeGenerator, max_subqueries: int = 3) -> AgentRAGPipeline:
    return AgentRAGPipeline(FakeEmbedder(), FakeRetriever({}), generator, 0.70, 0.80, max_subqueries)


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
