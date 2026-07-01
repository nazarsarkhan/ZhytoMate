"""
Purpose:   Slow, real-Postgres proof of the eval harness's OWN mechanics — seeding, hit-rate/routing
           scoring arithmetic, and cleanup — using DeterministicFakeEmbedder (not FakeEmbedder,
           whose all-zero vector is undefined under pgvector's cosine operator) against a real
           HybridRetriever/KnowledgeRepository/IngestService.

           SCOPE, read carefully: this test does NOT validate real semantic retrieval quality. The
           fake embedder's "similarity" comes from matching a handful of shared keywords between
           the gold queries and the fixture documents, not from a real embedding space — a green
           run here proves "the harness works" (seeds the right rows, scores them correctly, cleans
           up after itself), not "retrieval is good". Retrieval-quality validation against the real
           OpenAI embedding model is an operational concern (`python -m eval.run_eval` against a
           live KB with a live API key), not something this offline automated test can cover.
Layer:     test
May import:   pytest, pytest-asyncio, eval.run_eval, app.components.repository,
              app.components.hybrid_retriever, app.services.ingest_service, app.config,
              tests.fakes.fake_deterministic_embedder, tests.integration.conftest (via
              tests/eval/conftest.py)
Must NOT import:  openai, real network calls
"""
from __future__ import annotations

from pathlib import Path

import pytest

from app.components.hybrid_retriever import HybridRetriever
from app.components.repository import KnowledgeRepository
from app.config import Settings
from app.services.ingest_service import IngestService
from eval.run_eval import cleanup_fixtures, compute_retrieval_hitrate, compute_routing_accuracy, seed_fixtures
from tests.fakes.fake_deterministic_embedder import DeterministicFakeEmbedder

# pg_pool is session-scoped on the session event loop (tests/integration/conftest.py); align this
# module's test loop with it the same way tests/integration/test_repository.py does.
pytestmark = [pytest.mark.slow, pytest.mark.asyncio(loop_scope="session")]

_DATASETS_DIR = Path(__file__).resolve().parents[2] / "eval" / "datasets"
_FIXTURES_PATH = _DATASETS_DIR / "retrieval_fixtures.jsonl"
_RETRIEVAL_GOLD_PATH = _DATASETS_DIR / "retrieval_gold.jsonl"
_ROUTING_GOLD_PATH = _DATASETS_DIR / "routing_gold.jsonl"

_HITRATE_FLOOR = 0.90
_ROUTING_FLOOR = 0.95


def _unused_settings() -> Settings:
    """IngestService's constructor requires a Settings instance but never reads it — a filler value
    avoids depending on env vars (INTERNAL_TOKEN, etc.) that are irrelevant to this test."""
    return Settings(database_url="postgresql://unused", openai_api_key="unused", internal_token="unused")


async def _count_remaining_fixtures(pg_pool) -> int:
    return await pg_pool.fetchval(
        "SELECT count(*) FROM knowledge_base WHERE document_id LIKE 'eval_fixture_%'"
    )


async def test_eval_gate_seeds_scores_and_cleans_up(pg_pool) -> None:
    repo = KnowledgeRepository(pg_pool)
    embedder = DeterministicFakeEmbedder()
    retriever = HybridRetriever(repo, rrf_k=60)
    ingest_service = IngestService(repo, embedder, _unused_settings())

    document_ids = await seed_fixtures(ingest_service, _FIXTURES_PATH)
    assert len(document_ids) == 5

    try:
        routing_correct, routing_total = compute_routing_accuracy(_ROUTING_GOLD_PATH)
        hits, hitrate_total = await compute_retrieval_hitrate(
            retriever, embedder, _RETRIEVAL_GOLD_PATH, k=3
        )
    finally:
        await cleanup_fixtures(pg_pool, document_ids)

    assert routing_total == 6
    assert routing_correct / routing_total >= _ROUTING_FLOOR

    assert hitrate_total == 5
    assert hits / hitrate_total >= _HITRATE_FLOOR

    assert await _count_remaining_fixtures(pg_pool) == 0


async def test_cleanup_removes_seeded_rows_even_if_evaluation_raises(pg_pool) -> None:
    """The harness always wraps evaluation in try/finally: cleanup_fixtures(...) (see
    eval/run_eval.py's _run()). Prove that contract directly — force an exception between seeding
    and cleanup, and confirm the finally block still deletes every eval_fixture_* row."""
    repo = KnowledgeRepository(pg_pool)
    embedder = DeterministicFakeEmbedder()
    ingest_service = IngestService(repo, embedder, _unused_settings())

    document_ids = await seed_fixtures(ingest_service, _FIXTURES_PATH)
    assert await _count_remaining_fixtures(pg_pool) == 5

    class _SimulatedEvaluationFailure(Exception):
        pass

    with pytest.raises(_SimulatedEvaluationFailure):
        try:
            raise _SimulatedEvaluationFailure("forced mid-evaluation error")
        finally:
            await cleanup_fixtures(pg_pool, document_ids)

    assert await _count_remaining_fixtures(pg_pool) == 0
