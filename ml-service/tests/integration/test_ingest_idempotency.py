"""
Purpose:   Integration: IngestService's content_hash idempotency against a real Postgres repository
           — re-ingesting the SAME document_id with identical text is deduped before any embedding
           call, and re-ingesting it with EDITED text atomically replaces the old chunks (no
           leftover rows) instead of accumulating duplicates. KnowledgeRepository's own dedup/upsert
           SQL is already proven directly in test_repository.py
           (test_content_hash_dedup_prevents_double_ingest); this file's job is IngestService's
           orchestration on top of it — real Postgres, real KnowledgeRepository, FakeEmbedder (no
           OpenAI call needed to prove idempotency).
Layer:     test
May import:   pytest, testcontainers, app.components.repository, app.services.ingest_service,
              app.schemas/*, app.config, tests.fakes.fake_embedder, tests.integration.conftest
Must NOT import:  app.api routers, openai (DB-real, LLM-absent)
"""
from __future__ import annotations

import pytest

from app.components.repository import KnowledgeRepository
from app.config import Settings
from app.schemas.common import DocType
from app.schemas.ingest import IngestRequest
from app.services.ingest_service import IngestService
from tests.fakes.fake_embedder import FakeEmbedder

pytestmark = pytest.mark.asyncio(loop_scope="session")


def _settings() -> Settings:
    return Settings(
        database_url="postgresql://unused/unused",
        openai_api_key="unused",
        internal_token="unused",
    )


def _request(document_id: str, text: str) -> IngestRequest:
    return IngestRequest(
        document_id=document_id, text=text, doc_type=DocType.INSTRUCTION, source="http://city.zt.ua"
    )


async def test_reingesting_identical_text_is_deduped_and_embedder_runs_once(pg_pool) -> None:
    repo = KnowledgeRepository(pg_pool)
    embedder = FakeEmbedder()
    service = IngestService(repo, embedder, _settings())
    text = "Як подати заявку на субсидію через портал Дія."

    first = await service.ingest(_request("doc-subsidy", text))
    second = await service.ingest(_request("doc-subsidy", text))

    assert first.status == "ingested"
    assert first.chunks_processed == 1
    assert second.status == "duplicate"
    assert second.chunks_processed == 0
    assert len(embedder.encoded_passages) == 1, "the duplicate call must never reach the embedder"

    count = await pg_pool.fetchval(
        "SELECT COUNT(*) FROM knowledge_base WHERE document_id = $1", "doc-subsidy"
    )
    assert count == 1


async def test_reingesting_edited_text_replaces_old_chunks_without_duplicates(pg_pool) -> None:
    repo = KnowledgeRepository(pg_pool)
    embedder = FakeEmbedder()
    service = IngestService(repo, embedder, _settings())
    original_text = "Графік вивезення сміття у Корольовському районі — щовівторка."
    edited_text = "Графік вивезення сміття у Корольовському районі — щочетверга."

    first = await service.ingest(_request("doc-schedule", original_text))
    second = await service.ingest(_request("doc-schedule", edited_text))

    assert first.status == "ingested"
    assert second.status == "ingested"  # different content_hash -> not treated as a duplicate
    assert len(embedder.encoded_passages) == 2, "both distinct texts must reach the embedder"

    rows = await pg_pool.fetch(
        "SELECT text FROM knowledge_base WHERE document_id = $1", "doc-schedule"
    )
    assert len(rows) == 1, "the edited re-ingest must leave exactly one row, not two"
    assert rows[0]["text"] == edited_text
