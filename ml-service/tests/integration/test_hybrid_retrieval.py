"""
Purpose:   Integration (real Postgres+pgvector, seeded fixed vectors): the hybrid proof (ADR-011).
           A chunk whose embedding is dense-irrelevant to the query vector, but whose text contains
           an exact token the query also uses, is missed by the dense leg alone and recovered only
           through the lexical (tsvector) leg — surfaced end-to-end via HybridRetriever.retrieve()'s
           real RRF fusion. District/expires_at filtering and the SET LOCAL/iterative_scan behaviour
           are already covered by test_repository.py (test_set_local_iterative_scan_returns_results_
           when_filtered, test_expired_news_filtered_from_retrieval) and are deliberately not
           repeated here.
Layer:     test
May import:   pytest, testcontainers, app.components.repository, app.components.hybrid_retriever,
              tests.integration.conftest
Must NOT import:  google-genai (real Gemini never called in CI); app.api routers
"""
from __future__ import annotations

import pytest

from app.components.hybrid_retriever import HybridRetriever
from app.components.repository import ChunkRecord, KnowledgeRepository
from tests.integration.conftest import (
    make_content_hash,
    make_far_vec,
    make_random_vec,
    make_target_vec,
)

pytestmark = pytest.mark.asyncio(loop_scope="session")

_RRF_K = 60
# Every token in the query must also appear in the target's text: both websearch_to_tsquery and
# its plainto_tsquery fallback AND all bare terms together, so a query word absent from the target
# (e.g. an interrogative like "коли" that the target itself never states) would silently zero out
# the lexical match entirely rather than just lowering its rank.
_QUERY_TEXT = "Ремонт тротуару на вулиці Небесної Сотні?"
_TARGET_TEXT = "Ремонт тротуару на вулиці Небесної Сотні заплановано на 15 травня."


def _chunk(document_id: str, text: str, embedding, content_hash_seed: int) -> ChunkRecord:
    return ChunkRecord(
        document_id=document_id, chunk_index=0, text=text, embedding=embedding,
        doc_type="instruction", category=None, district=None,
        source="http://city.zt.ua", content_hash=make_content_hash(content_hash_seed),
        expires_at=None,
    )


async def test_lexical_leg_recovers_a_dense_irrelevant_exact_token_via_rrf(pg_pool) -> None:
    repo = KnowledgeRepository(pg_pool)
    retriever = HybridRetriever(repo, _RRF_K)

    base_vec = make_random_vec()
    query_vec = make_target_vec(base_vec, noise=0.01)

    # Five decoys: dense-CLOSE to the query vector, but their text shares no token with the query
    # (so the lexical leg never surfaces them) — this is what pure dense retrieval would return.
    decoys = [
        _chunk(f"doc_decoy_{i}", f"Про прибирання снігу взимку, випадок {i}.",
               make_target_vec(base_vec, noise=0.02), 500 + i)
        for i in range(5)
    ]
    # The target: dense-FAR from the query vector (a random, unrelated embedding), but its text
    # contains the exact street name and date the query asks about — a lexical-only hit.
    target = _chunk("doc_target", _TARGET_TEXT, make_far_vec(), 600)

    for chunk in [*decoys, target]:
        await repo.upsert_chunks(chunk.document_id, [chunk])

    outcome = await retriever.retrieve(_QUERY_TEXT, query_vec, None, k=3)

    dense_ids = {r.id for r in outcome.dense}
    fused_by_text = {r.text: r for r in outcome.fused}

    assert len(outcome.dense) == 3, "dense leg returns the k nearest neighbours by embedding alone"
    assert _TARGET_TEXT not in {r.text for r in outcome.dense}, (
        "the dense leg alone must miss the token-bearing chunk"
    )
    assert _TARGET_TEXT in fused_by_text, "RRF fusion must recover it via the lexical leg"
    assert fused_by_text[_TARGET_TEXT].id not in dense_ids

    # A lexical-only hit keeps similarity 0.0 in the fused result (domain/fusion.py's contract) —
    # the confidence gate must never mistake a keyword match for a real dense cosine score.
    assert fused_by_text[_TARGET_TEXT].similarity == 0.0


async def test_dense_only_retrieval_would_have_returned_nothing_relevant(pg_pool) -> None:
    """The negative control: calling the dense leg directly (bypassing HybridRetriever entirely)
    confirms the target is truly absent from a dense-only search, not just outranked."""
    repo = KnowledgeRepository(pg_pool)
    base_vec = make_random_vec()
    query_vec = make_target_vec(base_vec, noise=0.01)

    decoys = [
        _chunk(f"doc_decoy2_{i}", f"Про графік роботи водоканалу, випадок {i}.",
               make_target_vec(base_vec, noise=0.02), 700 + i)
        for i in range(3)
    ]
    target = _chunk("doc_target2", _TARGET_TEXT, make_far_vec(), 800)
    for chunk in [*decoys, target]:
        await repo.upsert_chunks(chunk.document_id, [chunk])

    dense_only = await repo.retrieve_dense(query_vec, None, limit=3)

    assert {r.text for r in dense_only} == {c.text for c in decoys}
    assert _TARGET_TEXT not in {r.text for r in dense_only}


async def test_or_fallback_ranks_by_distinct_term_coverage(pg_pool) -> None:
    """When both AND queries match nothing, the coverage-ranked OR fallback must rank a chunk that
    covers several query terms above one that merely repeats a single term (the price-list noise
    problem). Uses invented tokens so no other test's rows interfere."""
    repo = KnowledgeRepository(pg_pool)

    covering_text = "Зорквакс плюмбур фриндол зетафілер"  # 3 distinctive terms + the shared filler
    filler_text = "Зетафілер зетафілер зетафілер зетафілер зетафілер"  # one term repeated
    await repo.upsert_chunks(
        "doc_cover", [_chunk("doc_cover", covering_text, make_random_vec(), 900)]
    )
    await repo.upsert_chunks(
        "doc_filler", [_chunk("doc_filler", filler_text, make_random_vec(), 901)]
    )

    # "квазументи" is in no chunk, so websearch/plainto (which AND every term) return nothing and
    # the coverage-ranked OR fallback is exercised.
    rows = await repo.retrieve_lexical(
        "Зорквакс плюмбур фриндол зетафілер квазументи", None, 5
    )

    texts = [r.text for r in rows]
    assert covering_text in texts and filler_text in texts, "OR fallback surfaces both (recall)"
    assert texts[0] == covering_text, "multi-term chunk must outrank the single-repeated-term one"
