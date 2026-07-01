"""
Purpose:   Unit: eval.run_eval's LLM-as-judge helpers (_judge_one_row / run_judge) — no-context
           short-circuit (returns None, never calls the generator), verdict-string parsing
           (case-insensitive "YES" prefix match), and run_judge's aggregation (average over judged
           rows only, excluding the None entries produced by no-context rows, with a 0.0 fallback
           when either the gold set or the judged subset is empty). All against fakes — no real
           Postgres, no real OpenAI call, and no real file I/O (run_judge's `_read_jsonl` read is
           monkeypatched to hand back in-memory rows directly, since only the aggregation logic
           downstream of that read is under test here). This logic was previously untested
           (Finding 2).
Layer:     test
May import:   pytest, eval.run_eval, app.schemas.retrieval, tests.fakes/*
Must NOT import:  real asyncpg, real openai
"""
from __future__ import annotations

import pytest

import eval.run_eval as run_eval_module
from app.schemas.retrieval import RetrievalOutcome, RetrievalResult
from eval.run_eval import _judge_one_row, run_judge
from tests.fakes.fake_embedder import FakeEmbedder
from tests.fakes.fake_generator import FakeGenerator
from tests.fakes.fake_retriever import FakeRetriever


def _hit(text: str) -> RetrievalResult:
    return RetrievalResult(
        id=1, text=text, source="src", doc_type="instruction", district=None, similarity=0.9
    )


def _stub_gold_rows(monkeypatch: pytest.MonkeyPatch, rows: list[dict]) -> None:
    """run_judge() only ever uses its gold_path argument to call the module-level _read_jsonl —
    stubbing that call lets these tests hand it rows directly, keeping them pure in-memory unit
    tests rather than depending on any real file on disk."""
    monkeypatch.setattr(run_eval_module, "_read_jsonl", lambda path: rows)


async def test_judge_one_row_returns_true_when_verdict_starts_with_yes() -> None:
    query = "Як подати заявку на субсидію?"
    retriever = FakeRetriever({query: RetrievalOutcome(dense=[], fused=[_hit("контекст про субсидію")])})
    # Lowercase + trailing text on purpose: parsing is `.strip().upper().startswith("YES")`, not an
    # exact-match compare, so this must still count as grounded.
    generator = FakeGenerator(results=[("Ось відповідь", 0), ("yes, fully grounded", 0)])
    row = {"query": query, "district": None}

    verdict = await _judge_one_row(retriever, FakeEmbedder(), generator, row, k=3)

    assert verdict is True
    assert generator.call_count == 2  # one answer-generation call, one judge call


async def test_judge_one_row_returns_false_when_verdict_says_not_grounded() -> None:
    query = "Як подати заявку на субсидію?"
    retriever = FakeRetriever({query: RetrievalOutcome(dense=[], fused=[_hit("контекст про субсидію")])})
    generator = FakeGenerator(results=[("Ось відповідь", 0), ("NO", 0)])
    row = {"query": query, "district": None}

    verdict = await _judge_one_row(retriever, FakeEmbedder(), generator, row, k=3)

    assert verdict is False


async def test_judge_one_row_short_circuits_without_calling_generator_when_no_context() -> None:
    query = "Питання без жодного релевантного контексту"
    retriever = FakeRetriever({})  # no scripted entry -> FakeRetriever's empty-outcome default
    generator = FakeGenerator()
    row = {"query": query, "district": None}

    verdict = await _judge_one_row(retriever, FakeEmbedder(), generator, row, k=3)

    assert verdict is None  # None means "nothing to judge", distinct from False ("judged, ungrounded")
    assert generator.call_count == 0  # no wasted LLM calls when there's no context to check against


async def test_run_judge_averages_over_judged_rows_excluding_no_context_rows(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    grounded_query = "Запит з релевантним контекстом"
    ungrounded_query = "Запит з нерелевантною відповіддю"
    no_context_query = "Запит без жодного контексту"
    _stub_gold_rows(
        monkeypatch,
        [
            {"query": grounded_query, "district": None},
            {"query": no_context_query, "district": None},
            {"query": ungrounded_query, "district": None},
        ],
    )
    retriever = FakeRetriever(
        {
            grounded_query: RetrievalOutcome(dense=[], fused=[_hit("контекст 1")]),
            ungrounded_query: RetrievalOutcome(dense=[], fused=[_hit("контекст 2")]),
            # no_context_query is intentionally absent from the map.
        }
    )
    generator = FakeGenerator(results=[("відповідь 1", 0), ("YES", 0), ("відповідь 2", 0), ("no", 0)])

    score = await run_judge(retriever, FakeEmbedder(), generator, k=3)

    # 1 of the 2 JUDGED rows was graded grounded; the no-context row is excluded from the
    # denominator entirely rather than counted as a 0 — this is the averaging behaviour under test.
    assert score == 0.5


async def test_run_judge_returns_zero_when_gold_set_is_empty(monkeypatch: pytest.MonkeyPatch) -> None:
    _stub_gold_rows(monkeypatch, [])
    generator = FakeGenerator()

    score = await run_judge(FakeRetriever({}), FakeEmbedder(), generator, k=3)

    assert score == 0.0
    assert generator.call_count == 0


async def test_run_judge_returns_zero_when_no_query_returns_context(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    query = "Запит без жодного контексту"
    _stub_gold_rows(monkeypatch, [{"query": query, "district": None}])
    generator = FakeGenerator()

    score = await run_judge(FakeRetriever({}), FakeEmbedder(), generator, k=3)

    assert score == 0.0  # the "judged" set is empty here too, just via a non-empty gold file
    assert generator.call_count == 0
