"""
Purpose:   Unit: HybridRetriever's retrieval_leg_hits{leg} counter increments by the real hit count
           each leg contributed (dense/lexical), not a flat call counter — including the zero-hit
           case for an empty leg. Mirrors test_embedder.py's before/after counter-snapshot pattern
           (Prometheus counters are process-global, so a snapshot-and-delta assertion avoids
           cross-test contamination).
Layer:     test
May import:   pytest, numpy, app.components.hybrid_retriever, app.metrics, app.schemas.retrieval,
              tests.fakes/*
Must NOT import:  real asyncpg, real openai
"""
from __future__ import annotations

import numpy as np

from app.components.hybrid_retriever import HybridRetriever
from app.metrics import retrieval_leg_hits
from app.schemas.retrieval import RetrievalResult
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
