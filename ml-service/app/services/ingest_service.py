"""
Purpose:   Ingest orchestration (§2.4): normalize -> hash -> dedup check -> chunk -> embed(passage:)
           -> canonicalize district -> build ChunkRecords -> atomic upsert. Returns IngestResponse.
           Pure orchestration over injected components; no HTTP, no SQL, no model libs here.
Layer:     service
May import:   domain/* (text, chunker, districts), schemas/* , embedder + repository (injected),
              app.config, app.errors, app.metrics, structlog
Must NOT import:  other services/*, api/*, FastAPI/Starlette, asyncpg
"""
from __future__ import annotations

import time
from datetime import UTC, datetime, timedelta

import structlog

from app.components.embedder import Embedder
from app.components.repository import ChunkRecord, KnowledgeRepository
from app.config import Settings
from app.domain.chunker import chunk_text
from app.domain.districts import canonicalize_district
from app.domain.retention import is_evergreen_news
from app.domain.text import compute_content_hash, normalize_text
from app.metrics import dedup_skips_total, district_unmapped, ingest_chunks_total
from app.schemas.common import DocType
from app.schemas.ingest import DeleteResponse, IngestRequest, IngestResponse

logger = structlog.get_logger(__name__)


class IngestService:
    def __init__(
        self, repo: KnowledgeRepository, embedder: Embedder, settings: Settings
    ) -> None:
        self._repo = repo
        self._embedder = embedder
        self._settings = settings

    async def ingest(self, request: IngestRequest) -> IngestResponse:
        """Full idempotent pipeline (§2.4). Duplicate content and already-expired news both
        short-circuit before any embedding."""
        start = time.perf_counter()

        normalized = normalize_text(request.text)
        content_hash = compute_content_hash(request.text)

        if await self._repo.content_hash_exists(content_hash):
            dedup_skips_total.inc()
            logger.info("ingest_duplicate", doc=request.document_id)
            return IngestResponse(
                status="duplicate", document_id=request.document_id, chunks_processed=0
            )

        expires_at = self._expires_at(request)
        if expires_at is not None and expires_at <= datetime.now(UTC):
            logger.info(
                "ingest_skipped_expired",
                doc=request.document_id,
                expires_at=expires_at.isoformat(),
            )
            return IngestResponse(
                status="expired", document_id=request.document_id, chunks_processed=0
            )

        chunks = chunk_text(normalized, self._embedder.count_tokens)
        ingest_chunks_total.inc(len(chunks))
        embeddings = await self._embedder.encode_passages(chunks)  # shape (n, 1536)

        district_slug = canonicalize_district(request.district)
        if request.district is not None and district_slug is None:
            logger.warning(
                "ingest_unknown_district", raw=request.district, doc=request.document_id
            )
            district_unmapped.labels(boundary="ingest").inc()

        records = [
            ChunkRecord(
                document_id=request.document_id,
                chunk_index=index,
                text=chunk,
                embedding=embeddings[index],
                doc_type=request.doc_type.value,
                category=request.category,
                district=district_slug,
                source=request.source,
                content_hash=content_hash,
                expires_at=expires_at,
            )
            for index, chunk in enumerate(chunks)
        ]
        await self._repo.upsert_chunks(request.document_id, records)
        self._settings.knowledge_base_version += 1

        took_ms = (time.perf_counter() - start) * 1000
        logger.info(
            "ingest_ok",
            doc=request.document_id,
            type=request.doc_type.value,
            chunks=len(chunks),
            district=district_slug,
            took_ms=round(took_ms, 1),
        )
        return IngestResponse(
            status="ingested", document_id=request.document_id, chunks_processed=len(chunks)
        )

    async def delete(self, document_id: str) -> DeleteResponse:
        """Delete a document and all its chunks (idempotent — an absent id returns 0)."""
        count = await self._repo.delete_document(document_id)
        if count:
            self._settings.knowledge_base_version += 1
        logger.info("delete_doc doc=%s chunks=%d", document_id, count)
        return DeleteResponse(document_id=document_id, chunks_deleted=count)

    @staticmethod
    def _expires_at(request: IngestRequest) -> datetime | None:
        """time-bound news -> published_at (or ingest time when absent) + ttl_days; documents
        and evergreen-category news (e.g. memorials) -> never expire, i.e. NULL (§2.5). Anchoring
        to publication time rather than now() keeps expiry deterministic across re-ingests/retries
        and correct for backfilled items. ttl_days presence is guaranteed for news by the schema
        validator."""
        if request.doc_type is not DocType.NEWS or is_evergreen_news(request.category):
            return None
        assert request.ttl_days is not None  # enforced by IngestRequest's model_validator
        published = request.published_at or datetime.now(UTC)
        if published.tzinfo is None:
            published = published.replace(tzinfo=UTC)
        return published + timedelta(days=request.ttl_days)
