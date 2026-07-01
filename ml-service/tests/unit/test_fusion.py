"""
Purpose:   Unit: reciprocal_rank_fusion() — dedups a chunk seen in both legs, keeps the dense object
           (so its cosine survives), and ranks a chunk that is top in both legs above the rest.
           Uses a lightweight duck-typed result so the test stays pure (no asyncpg/pgvector).
Layer:     test
May import:   pytest, app.domain.fusion, stdlib
Must NOT import:  app.api, app.services, app.components, app.pipeline; asyncpg, google-genai
              (pure/fast unit test)
"""
from __future__ import annotations

from dataclasses import dataclass

from app.domain.fusion import reciprocal_rank_fusion


@dataclass
class _Result:
    """Stand-in for schemas.retrieval.RetrievalResult — fusion only reads .id (and carries the
    rest)."""

    id: int
    text: str = ""
    source: str = ""
    doc_type: str = "news"
    district: str | None = None
    similarity: float = 0.0


def test_rrf_merge_dedup() -> None:
    dense = [_Result(1, similarity=0.9), _Result(2, similarity=0.8)]
    lexical = [_Result(1), _Result(3)]
    fused = reciprocal_rank_fusion(dense, lexical, k=60)
    ids = [r.id for r in fused]
    assert sorted(ids) == [1, 2, 3]
    assert len(ids) == len(set(ids))  # chunk 1 appears exactly once


def test_rrf_prefers_dense() -> None:
    dense = [_Result(1, similarity=0.91)]
    lexical = [_Result(1, similarity=0.0)]
    fused = reciprocal_rank_fusion(dense, lexical, k=60)
    assert len(fused) == 1
    assert fused[0].similarity == 0.91  # the dense object (its cosine) is kept


def test_rrf_order() -> None:
    # Chunk 1 is rank 0 in both legs -> highest fused score; chunk 2 is rank 1 in both.
    dense = [_Result(1, similarity=0.9), _Result(2, similarity=0.85)]
    lexical = [_Result(1), _Result(2)]
    fused = reciprocal_rank_fusion(dense, lexical, k=60)
    assert [r.id for r in fused] == [1, 2]


def test_rrf_empty_leg() -> None:
    dense = [_Result(1, similarity=0.7)]
    fused = reciprocal_rank_fusion(dense, [], k=60)
    assert [r.id for r in fused] == [1]
