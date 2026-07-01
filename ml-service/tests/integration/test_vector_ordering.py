"""
Purpose:   Integration: with seeded vectors, cosine ordering of retrieved rows is exact and
           deterministic. This is a genuine gap, not a duplicate of test_repository.py: that file's
           tests check FILTERING correctness and row COUNTS against single-hit or same-similarity-
           tier data, never a multi-row result set with meaningfully different similarities — so
           nothing there actually proves KnowledgeRepository.retrieve_dense's
           `ORDER BY embedding <=> $1::vector` returns rows by descending cosine similarity.
           unit/test_fusion.py's test_rrf_order proves RRF ordering in pure Python given
           already-ranked inputs; it never touches the real SQL that produces those rankings.
Layer:     test
May import:   pytest, testcontainers, app.components.repository, numpy
Must NOT import:  app.api routers, openai (DB-real, LLM-absent)
"""
from __future__ import annotations

import numpy as np
import pytest

from app.components.repository import ChunkRecord, KnowledgeRepository
from tests.integration.conftest import make_content_hash, make_random_vec

pytestmark = pytest.mark.asyncio(loop_scope="session")


def _vec_with_similarity(base: np.ndarray, target_cosine: float) -> np.ndarray:
    """A unit vector whose cosine similarity to `base` is EXACTLY target_cosine (up to float
    precision): base*cos(theta) + orthogonal*sin(theta) for a random unit vector orthogonal to
    base. Deterministic by construction — unlike noise-scaled vectors (make_target_vec), which
    "usually" separate by similarity but empirically invert up to ~18% of the time once the noise
    level gets large (measured directly: two vectors built from noise=0.4 and noise=0.8 around the
    same base land in the wrong order about one time in five), which would make this specific test
    flaky rather than merely probabilistic like the rest of the suite.
    """
    random_vec = np.random.randn(len(base)).astype(np.float32)
    orthogonal = random_vec - np.dot(random_vec, base) * base
    orthogonal = orthogonal / np.linalg.norm(orthogonal)
    theta = np.arccos(target_cosine)
    vec = np.cos(theta) * base + np.sin(theta) * orthogonal
    return (vec / np.linalg.norm(vec)).astype(np.float32)


def _seed_chunk(document_id: str, text: str, embedding: np.ndarray, hash_seed: int) -> ChunkRecord:
    return ChunkRecord(
        document_id=document_id, chunk_index=0, text=text, embedding=embedding,
        doc_type="instruction", category=None, district=None,
        source="http://test", content_hash=make_content_hash(hash_seed), expires_at=None,
    )


async def test_retrieve_dense_orders_results_by_descending_cosine_similarity(pg_pool) -> None:
    """Four chunks at deliberately distinct, exactly-known similarities to the query vector must
    come back in strict descending-similarity order, matching the repository's own reported
    similarity for each row."""
    repo = KnowledgeRepository(pg_pool)
    query_vec = make_random_vec()
    target_similarities = [0.95, 0.7, 0.4, 0.05]

    chunks = [
        _seed_chunk(f"doc_order_{i}", f"chunk at similarity {sim}",
                    _vec_with_similarity(query_vec, sim), 300 + i)
        for i, sim in enumerate(target_similarities)
    ]
    for chunk in chunks:
        await repo.upsert_chunks(chunk.document_id, [chunk])

    results = await repo.retrieve_dense(query_vec, None, limit=4)

    assert [r.text for r in results] == [f"chunk at similarity {sim}" for sim in target_similarities]
    for result, expected_sim in zip(results, target_similarities):
        assert result.similarity == pytest.approx(expected_sim, abs=1e-3)


async def test_retrieve_dense_ordering_holds_under_a_tighter_limit(pg_pool) -> None:
    """Same property under LIMIT < total rows: the top-k BY similarity, not an arbitrary k of the
    seeded rows — proves ordering is applied before truncation, not after."""
    repo = KnowledgeRepository(pg_pool)
    query_vec = make_random_vec()
    similarities_by_seed_order = [0.9, 0.6, 0.3, 0.1, 0.85]  # deliberately seeded out of order

    chunks = [
        _seed_chunk(f"doc_topk_{i}", f"chunk {i}", _vec_with_similarity(query_vec, sim), 400 + i)
        for i, sim in enumerate(similarities_by_seed_order)
    ]
    for chunk in chunks:
        await repo.upsert_chunks(chunk.document_id, [chunk])

    results = await repo.retrieve_dense(query_vec, None, limit=3)

    # Top 3 by similarity: chunk 0 (0.9), chunk 4 (0.85), chunk 1 (0.6) — not the first 3 inserted.
    assert [r.text for r in results] == ["chunk 0", "chunk 4", "chunk 1"]
