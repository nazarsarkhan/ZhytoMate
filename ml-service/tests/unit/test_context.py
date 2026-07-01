"""
Purpose:   Unit: assemble_context() — dedup by chunk id (first occurrence wins), preserves retrieval
           order, trims to a token budget via an injected counter, and always keeps at least the
           top-ranked chunk even if it alone exceeds the budget. Asserts dedup happens before
           budget-counting so a duplicate never eats into the budget meant for a distinct chunk.
Layer:     test
May import:   pytest, app.domain.context, app.schemas.retrieval, stdlib
Must NOT import:  app.api, app.services, app.components, app.pipeline; asyncpg, google-genai
              (pure/fast unit test)
"""
from __future__ import annotations

from app.domain.context import assemble_context
from app.schemas.retrieval import RetrievalResult


def _result(chunk_id: int, text: str) -> RetrievalResult:
    return RetrievalResult(
        id=chunk_id, text=text, source="src", doc_type="news", district=None, similarity=0.9
    )


def _count_words(text: str) -> int:
    """Simple, deterministic stand-in for the real tiktoken-based counter."""
    return len(text.split())


def test_assemble_context_preserves_order_when_no_duplicates() -> None:
    chunks = [_result(1, "one two"), _result(2, "three four"), _result(3, "five six")]
    kept = assemble_context(chunks, token_budget=100, count_tokens_fn=_count_words)
    assert [c.id for c in kept] == [1, 2, 3]


def test_assemble_context_dedups_keeping_first_occurrence_at_its_position() -> None:
    first = _result(1, "first version")
    other = _result(2, "other chunk")
    duplicate = _result(1, "duplicate version, should be dropped")
    kept = assemble_context(
        [first, other, duplicate], token_budget=100, count_tokens_fn=_count_words
    )
    assert [c.id for c in kept] == [1, 2]
    assert kept[0] is first


def test_assemble_context_trims_chunks_beyond_the_token_budget() -> None:
    # 3 tokens each: chunk 1 alone fits (3 <= 5); chunk 1 + chunk 2 (6) exceeds the budget of 5, so
    # chunk 2 and everything after it is dropped.
    chunks = [_result(1, "a b c"), _result(2, "d e f"), _result(3, "g h i")]
    kept = assemble_context(chunks, token_budget=5, count_tokens_fn=_count_words)
    assert [c.id for c in kept] == [1]


def test_assemble_context_always_keeps_first_chunk_even_if_it_alone_exceeds_budget() -> None:
    oversized = _result(1, " ".join(["word"] * 50))
    kept = assemble_context([oversized], token_budget=10, count_tokens_fn=_count_words)
    assert [c.id for c in kept] == [1]


def test_assemble_context_dedup_runs_before_budget_counting() -> None:
    # Chunk 1 appears twice (3 tokens each occurrence). If the duplicate were counted toward the
    # budget, the running total would hit 6 before chunk 2 is ever considered, wrongly dropping it.
    # Since dedup happens first, only one occurrence of chunk 1 counts, leaving room for chunk 2.
    chunks = [_result(1, "a b c"), _result(1, "a b c"), _result(2, "d e f")]
    kept = assemble_context(chunks, token_budget=6, count_tokens_fn=_count_words)
    assert [c.id for c in kept] == [1, 2]


def test_assemble_context_returns_empty_list_for_empty_input() -> None:
    assert assemble_context([], token_budget=100, count_tokens_fn=_count_words) == []
