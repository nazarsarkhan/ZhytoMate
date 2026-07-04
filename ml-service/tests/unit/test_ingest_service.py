"""
Purpose:   Unit: IngestService's Prometheus counters — dedup_skips_total increments by exactly one
           and the embedder is never touched when content_hash_exists() reports a duplicate;
           ingest_chunks_total increments by the real chunk count on a fresh, successful ingest.
           Mirrors test_embedder.py's before/after counter-snapshot pattern (Prometheus counters are
           process-global, so a snapshot-and-delta assertion avoids cross-test contamination).
Layer:     test
May import:   pytest, app.services.ingest_service, app.schemas/*, app.config, app.metrics,
              tests.fakes/*
Must NOT import:  real asyncpg, real openai
"""
from __future__ import annotations

from datetime import UTC, datetime, timedelta

from app.config import Settings
from app.metrics import dedup_skips_total, ingest_chunks_total
from app.schemas.common import DocType
from app.schemas.ingest import IngestRequest
from app.services.ingest_service import IngestService
from tests.fakes.fake_embedder import FakeEmbedder
from tests.fakes.fake_repository import FakeKnowledgeRepository


def _settings(**overrides: object) -> Settings:
    defaults: dict[str, object] = {
        "database_url": "postgresql://unused/unused",
        "openai_api_key": "unused",
        "internal_token": "unused",
    }
    defaults.update(overrides)
    return Settings(**defaults)


def _request(**overrides: object) -> IngestRequest:
    defaults: dict[str, object] = {
        "document_id": "doc-1",
        "text": "Сміття вивозять щовівторка.",
        "doc_type": DocType.INSTRUCTION,
        "source": "src",
    }
    defaults.update(overrides)
    return IngestRequest(**defaults)


def _counter_value(counter) -> float:
    return counter._value.get()  # noqa: SLF001 — prometheus_client exposes no public reader


async def test_duplicate_content_hash_increments_dedup_skips_and_skips_embedding() -> None:
    repo = FakeKnowledgeRepository(content_hash_exists=True)
    embedder = FakeEmbedder()
    service = IngestService(repo, embedder, _settings())
    before = _counter_value(dedup_skips_total)

    response = await service.ingest(_request())

    assert response.status == "duplicate"
    assert response.chunks_processed == 0
    assert _counter_value(dedup_skips_total) == before + 1
    assert embedder.encoded_passages == []  # dedup short-circuits before any embedding call
    assert repo.upsert_calls == []


async def test_successful_ingest_increments_ingest_chunks_total_by_the_real_chunk_count() -> None:
    repo = FakeKnowledgeRepository(content_hash_exists=False)
    embedder = FakeEmbedder()
    service = IngestService(repo, embedder, _settings())
    before = _counter_value(ingest_chunks_total)

    response = await service.ingest(_request())

    assert response.status == "ingested"
    assert response.chunks_processed >= 1
    assert _counter_value(ingest_chunks_total) == before + response.chunks_processed
    assert len(repo.upsert_calls) == 1


async def test_news_expiry_is_anchored_to_published_at_not_ingest_time() -> None:
    repo = FakeKnowledgeRepository(content_hash_exists=False)
    embedder = FakeEmbedder()
    service = IngestService(repo, embedder, _settings())
    published = datetime.now(UTC)

    response = await service.ingest(
        _request(doc_type=DocType.NEWS, ttl_days=30, published_at=published)
    )

    assert response.status == "ingested"
    _, records = repo.upsert_calls[0]
    assert records[0].expires_at == published + timedelta(days=30)


async def test_news_born_expired_is_skipped_before_embedding() -> None:
    repo = FakeKnowledgeRepository(content_hash_exists=False)
    embedder = FakeEmbedder()
    service = IngestService(repo, embedder, _settings())
    published = datetime(2020, 1, 1, tzinfo=UTC)  # published_at + ttl_days is far in the past

    response = await service.ingest(
        _request(doc_type=DocType.NEWS, ttl_days=2, published_at=published)
    )

    assert response.status == "expired"
    assert response.chunks_processed == 0
    assert embedder.encoded_passages == []  # never reaches the embedder
    assert repo.upsert_calls == []


async def test_evergreen_memorial_news_never_expires_and_is_not_skipped() -> None:
    repo = FakeKnowledgeRepository(content_hash_exists=False)
    embedder = FakeEmbedder()
    service = IngestService(repo, embedder, _settings())
    published = datetime(2020, 1, 1, tzinfo=UTC)  # old enough to be born-expired for normal news

    response = await service.ingest(
        _request(
            doc_type=DocType.NEWS, category="memorial", ttl_days=14, published_at=published
        )
    )

    assert response.status == "ingested"  # evergreen -> not skipped despite its age
    _, records = repo.upsert_calls[0]
    assert records[0].expires_at is None  # permanent record, like an instruction
