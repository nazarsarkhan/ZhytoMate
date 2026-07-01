"""
Purpose:   Unit: is_sufficient() — returns True when enough distinct hits clear sim_gate; False when
           a sub-query is thin/empty (triggering the single bounded re-query in the agent loop).
           Asserts thresholds are honoured from passed-in arguments (never imported from config),
           and that the sim_gate boundary is inclusive — matching confidence.py's own "top1_sim ==
           sim_gate is not no-info" boundary choice.
Layer:     test
May import:   pytest, app.domain.sufficiency, app.schemas.retrieval, stdlib
Must NOT import:  app.api, app.services, app.components, app.pipeline; asyncpg, openai (pure/fast
              unit test)
"""
from __future__ import annotations

from app.domain.sufficiency import is_sufficient
from app.schemas.retrieval import RetrievalResult


def _result(chunk_id: int, similarity: float) -> RetrievalResult:
    return RetrievalResult(
        id=chunk_id, text="text", source="src", doc_type="news", district=None,
        similarity=similarity,
    )


def test_empty_dense_is_never_sufficient() -> None:
    assert is_sufficient([], sim_gate=0.70) is False


def test_below_gate_hits_do_not_count() -> None:
    dense = [_result(1, 0.5), _result(2, 0.69)]
    assert is_sufficient(dense, sim_gate=0.70) is False


def test_at_gate_hit_counts_inclusive() -> None:
    # Mirrors confidence.py: top1_sim == sim_gate is NOT no-info, so it must count as a hit here
    # too.
    dense = [_result(1, 0.70)]
    assert is_sufficient(dense, sim_gate=0.70) is True


def test_default_min_hits_is_one() -> None:
    dense = [_result(1, 0.90)]
    assert is_sufficient(dense, sim_gate=0.70) is True


def test_min_hits_requires_that_many_qualifying_results() -> None:
    one_good_one_bad = [_result(1, 0.90), _result(2, 0.60)]
    assert is_sufficient(one_good_one_bad, sim_gate=0.70, min_hits=2) is False

    two_good = [_result(1, 0.90), _result(2, 0.75)]
    assert is_sufficient(two_good, sim_gate=0.70, min_hits=2) is True


def test_only_hits_at_or_above_gate_are_counted_toward_min_hits() -> None:
    mixed = [_result(1, 0.90), _result(2, 0.95), _result(3, 0.10)]
    assert is_sufficient(mixed, sim_gate=0.70, min_hits=2) is True
    assert is_sufficient(mixed, sim_gate=0.70, min_hits=3) is False
