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
              tests.fakes.fake_deterministic_embedder, tests.fakes.fake_retriever,
              tests.integration.conftest (via tests/eval/conftest.py)
Must NOT import:  openai, real network calls
"""
from __future__ import annotations

from pathlib import Path

import pytest

from app.components.hybrid_retriever import HybridRetriever
from app.components.repository import KnowledgeRepository
from app.config import Settings
from app.services.ingest_service import IngestService
from eval.run_eval import (
    cleanup_fixtures,
    compute_retrieval_hitrate,
    compute_routing_accuracy,
    run_evaluation,
    seed_fixtures,
)
from tests.fakes.fake_deterministic_embedder import DeterministicFakeEmbedder
from tests.fakes.fake_retriever import FakeRetriever

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
    """The harness's real seed -> evaluate -> cleanup contract lives in eval.run_eval.run_evaluation()
    (the function _run() delegates to once it has wired up real credentials). Drive THAT function
    directly — not a reimplementation of its try/finally — with an injected Retriever that raises
    partway through compute_retrieval_hitrate(), after the real fixtures have already been seeded
    through the real IngestService against real Postgres. This is the test the reviewer's
    experiment (commenting out the real `await cleanup_fixtures(...)` call inside run_evaluation()'s
    finally block) should — and does — turn red for."""
    repo = KnowledgeRepository(pg_pool)
    embedder = DeterministicFakeEmbedder()
    ingest_service = IngestService(repo, embedder, _unused_settings())

    class _SimulatedRetrievalFailure(Exception):
        pass

    # Any query from retrieval_gold.jsonl works — compute_retrieval_hitrate() iterates the gold
    # rows in file order and this one is scored second, so the failure genuinely lands mid-loop,
    # after fixtures are seeded and after at least one retrieval already succeeded.
    failing_query = "Як подати заявку на встановлення лічильника води?"
    failing_retriever = FakeRetriever(
        {failing_query: _SimulatedRetrievalFailure("forced mid-evaluation error")}
    )

    assert await _count_remaining_fixtures(pg_pool) == 0

    with pytest.raises(_SimulatedRetrievalFailure):
        await run_evaluation(
            ingest_service,
            failing_retriever,
            embedder,
            pg_pool,
            fixtures_path=_FIXTURES_PATH,
            routing_gold_path=_ROUTING_GOLD_PATH,
            retrieval_gold_path=_RETRIEVAL_GOLD_PATH,
        )

    assert await _count_remaining_fixtures(pg_pool) == 0
