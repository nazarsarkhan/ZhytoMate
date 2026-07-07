"""
Purpose:   Unit: HybridRetriever's retrieval_leg_hits{leg} counter increments by the real hit count
           each leg contributed (dense/lexical), not a flat call counter — including the zero-hit
           case for an empty leg. Mirrors test_embedder.py's before/after counter-snapshot pattern
           (Prometheus counters are process-global, so a snapshot-and-delta assertion avoids
           cross-test contamination). Also covers RetrievalOutcome.lexical_top1_id (the property
           run_shared_tail's strong_lexical_match check reads) and that HybridRetriever actually
           attaches the RAW (unfused) lexical leg to the outcome, since that property is only
           meaningful if lexical[0] is the lexical leg's own genuine rank-1 pick.
Layer:     test
May import:   pytest, numpy, app.components.hybrid_retriever, app.metrics, app.schemas.retrieval,
              tests.fakes/*
Must NOT import:  real asyncpg, real openai
"""
from __future__ import annotations

import numpy as np

from app.components.hybrid_retriever import HybridRetriever
from app.metrics import retrieval_leg_hits
from app.schemas.retrieval import RetrievalOutcome, RetrievalResult
from tests.fakes.fake_repository import FakeKnowledgeRepository

_QUERY_VEC = np.zeros(1536, dtype=np.float32)


def _hit(chunk_id: int) -> RetrievalResult:
    return RetrievalResult(
        id=chunk_id, text="текст", source="src", doc_type="instruction", district=None,
        similarity=0.9,
    )


def _leg_count(leg: str) -> float:
    return retrieval_leg_hits.labels(leg=leg)._value.get()  # noqa: SLF001 — no public reader


async def test_retrieve_increments_each_leg_by_its_own_hit_count() -> None:
    repo = FakeKnowledgeRepository(dense=[_hit(1), _hit(2)], lexical=[_hit(3)])
    retriever = HybridRetriever(repo, 60)
    before_dense, before_lexical = _leg_count("dense"), _leg_count("lexical")

    await retriever.retrieve("query", _QUERY_VEC, None, k=10)

    assert _leg_count("dense") == before_dense + 2
    assert _leg_count("lexical") == before_lexical + 1


async def test_retrieve_with_an_empty_leg_increments_it_by_zero() -> None:
    repo = FakeKnowledgeRepository(dense=[], lexical=[_hit(1)])
    retriever = HybridRetriever(repo, 60)
    before_dense, before_lexical = _leg_count("dense"), _leg_count("lexical")

    await retriever.retrieve("query", _QUERY_VEC, None, k=10)

    assert _leg_count("dense") == before_dense
    assert _leg_count("lexical") == before_lexical + 1


async def test_retrieve_attaches_the_raw_lexical_leg_to_the_outcome() -> None:
    """RetrievalOutcome.lexical must be the UNFUSED lexical leg (the same list retrieve_lexical
    returned, in its own rank order) — not the RRF-fused order. run_shared_tail's
    strong_lexical_match check depends on lexical[0] being the lexical leg's own genuine rank-1
    pick, independent of how RRF re-orders the fused list."""
    repo = FakeKnowledgeRepository(dense=[_hit(1)], lexical=[_hit(2), _hit(1)])
    retriever = HybridRetriever(repo, 60)

    outcome = await retriever.retrieve("query", _QUERY_VEC, None, k=10)

    assert [chunk.id for chunk in outcome.lexical] == [2, 1]
    assert outcome.lexical_top1_id == 2


def test_lexical_top1_id_is_none_when_lexical_leg_is_empty() -> None:
    outcome = RetrievalOutcome(dense=[], fused=[])
    assert outcome.lexical_top1_id is None


def test_lexical_top1_id_is_the_first_lexical_hits_id() -> None:
    outcome = RetrievalOutcome(dense=[], fused=[], lexical=[_hit(7), _hit(3)])
    assert outcome.lexical_top1_id == 7
