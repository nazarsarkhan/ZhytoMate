"""
Purpose:   Reciprocal Rank Fusion (RRF) — merges the dense (pgvector) and lexical (tsvector)
           RetrievalResult lists by rank position, not raw score: score(doc) = Σ_legs 1/(k+rank),
           dedup by chunk id, re-order. The hybrid-retrieval merge step (ADR-011, k=60). The
           returned `similarity` is the ORIGINAL dense cosine (0.0 if lexical-only) — never the RRF
           score; the confidence gate reads dense top-1, not this fused order.
Layer:     domain (pure — no I/O at runtime)
May import:   stdlib; app.schemas.retrieval.RetrievalResult (TYPE_CHECKING only — duck-typed on .id
              at runtime, so this stays importable without asyncpg/pgvector and trivially
              unit-testable)
Must NOT import:  services/*, api/*, embedder, asyncpg, FastAPI (none imported at runtime)
"""
from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.schemas.retrieval import RetrievalResult


def reciprocal_rank_fusion(
    dense: list[RetrievalResult],
    lexical: list[RetrievalResult],
    k: int = 60,
) -> list[RetrievalResult]:
    """
    Merge two ranked lists via RRF: score(doc) = Σ_legs 1 / (k + rank) (rank is 0-based).

    Dedup by chunk id, ordering by descending fused score. When a chunk appears in both legs the
    dense object is kept (so its cosine similarity survives); lexical-only chunks keep their 0.0.
    The result may be shorter than either input. Empty legs are handled.
    """
    scores: dict[int, float] = {}
    # Process lexical first, then dense, so the dense object wins on dedup (last write to the map).
    result_map: dict[int, RetrievalResult] = {}
    for leg in (lexical, dense):
        for rank, item in enumerate(leg):
            scores[item.id] = scores.get(item.id, 0.0) + 1.0 / (k + rank)
            result_map[item.id] = item
    ordered_ids = sorted(scores, key=lambda chunk_id: scores[chunk_id], reverse=True)
    return [result_map[chunk_id] for chunk_id in ordered_ids]
