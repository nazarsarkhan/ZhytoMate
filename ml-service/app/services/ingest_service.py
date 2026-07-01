"""
Purpose:   Ingest orchestration (§2.4): normalize -> hash -> dedup check -> chunk -> embed(passage:)
           -> canonicalize district -> build ChunkRecords -> atomic upsert. Returns IngestResponse.
           Pure orchestration over injected components; no HTTP, no SQL, no model libs here.
Layer:     service
May import:   domain/* (text, chunker, districts), schemas/* , embedder + repository (injected), app.config, app.errors
Must NOT import:  other services/*, api/*, FastAPI/Starlette, asyncpg
"""
from __future__ import annotations

import logging
import time
from datetime import datetime, timedelta, timezone

from app.components.embedder import Embedder
from app.components.repository import ChunkRecord, KnowledgeRepository
from app.config import Settings
from app.domain.chunker import chunk_text
from app.domain.districts import canonicalize_district
from app.domain.text import compute_content_hash, normalize_text
from app.metrics import district_unmapped
from app.schemas.common import DocType
from app.schemas.ingest import IngestRequest, IngestResponse

logger = logging.getLogger(__name__)


class IngestService:
    def __init__(
        self, repo: KnowledgeRepository, embedder: Embedder, settings: Settings
    ) -> None:
        self._repo = repo
        self._embedder = embedder
        self._settings = settings

    async def ingest(self, request: IngestRequest) -> IngestResponse:
        """Full idempotent pipeline (§2.4). Duplicate content short-circuits before any embedding."""
        start = time.perf_counter()

        normalized = normalize_text(request.text)
        content_hash = compute_content_hash(request.text)

        if await self._repo.content_hash_exists(content_hash):
            logger.info("ingest_duplicate doc=%s", request.document_id)
            return IngestResponse(
                status="duplicate", document_id=request.document_id, chunks_processed=0
            )

        chunks = chunk_text(normalized, self._embedder.count_tokens)
        embeddings = await self._embedder.encode_passages(chunks)  # shape (n, 1536)

        district_slug = canonicalize_district(request.district)
        if request.district is not None and district_slug is None:
            logger.warning(
                "ingest_unknown_district raw=%r doc=%s", request.district, request.document_id
            )
            district_unmapped.labels(boundary="ingest").inc()

        expires_at = self._expires_at(request)

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

        took_ms = (time.perf_counter() - start) * 1000
        logger.info(
            "ingest_ok doc=%s type=%s chunks=%d district=%s took=%.1fms",
            request.document_id, request.doc_type.value, len(chunks), district_slug, took_ms,
        )
        return IngestResponse(
            status="ingested", document_id=request.document_id, chunks_processed=len(chunks)
        )

    @staticmethod
    def _expires_at(request: IngestRequest) -> datetime | None:
        """news -> now()+ttl_days; instruction -> never expires (§2.5). ttl_days presence is guaranteed
        for news by the schema validator."""
        if request.doc_type is DocType.NEWS:
            return datetime.now(timezone.utc) + timedelta(days=request.ttl_days)
        return None
