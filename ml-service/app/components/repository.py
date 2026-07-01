"""
Purpose:   asyncpg pool (register_vector in the init callback) + KnowledgeRepository:
           content-hash check, idempotent upsert (DELETE + executemany in one tx), dense
           retrieval (SET LOCAL hnsw.* MUST share the SAME tx as the SELECT — asyncpg autocommit
           would discard them), lexical retrieval (websearch->plainto fallback), Postgres
           rate-limit upsert, and TTL delete. Internal dataclass ChunkRecord (ingest-time transfer,
           stays here). RetrievalResult lives in app.schemas.retrieval — the port abstraction in
           app.protocols needs it and may not import components/*.
Layer:     component (repository)
May import:   app.config (types), app.schemas.retrieval, stdlib, numpy, asyncpg, pgvector
Must NOT import:  services/*, api/*, pipeline/*, other components/*; FastAPI
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from datetime import datetime

import asyncpg
import numpy as np
from pgvector.asyncpg import register_vector

from app.config import Settings
from app.schemas.retrieval import RetrievalResult

logger = logging.getLogger(__name__)


async def create_pool(settings: Settings) -> asyncpg.Pool:
    async def init(conn: asyncpg.Connection) -> None:
        # Runs on EVERY pooled connection: registers the vector codec so VECTOR columns
        # marshal to/from numpy arrays transparently.
        await register_vector(conn)

    return await asyncpg.create_pool(
        settings.database_url,
        min_size=2,
        max_size=10,
        command_timeout=10,
        max_inactive_connection_lifetime=300,
        init=init,
    )


@dataclass
class ChunkRecord:
    """One row to insert into knowledge_base (internal transfer; not external I/O)."""

    document_id: str
    chunk_index: int
    text: str
    embedding: np.ndarray            # shape (1536,), normalized
    doc_type: str                    # 'news' | 'instruction'
    category: str | None
    district: str | None             # canonical slug or None (city-wide)
    source: str
    content_hash: str                # sha256 hex, 64 chars
    expires_at: datetime | None      # None for instruction


_INSERT_SQL = """
    INSERT INTO knowledge_base
        (document_id, chunk_index, text, embedding, doc_type,
         category, district, source, content_hash, expires_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
"""

_DENSE_SQL = """
    SELECT id, text, source, doc_type, district,
           1 - (embedding <=> $1::vector) AS similarity
    FROM knowledge_base
    WHERE (doc_type = 'instruction' OR expires_at > now())
      AND ($2::text IS NULL OR district = $2 OR district IS NULL)
    ORDER BY embedding <=> $1::vector
    LIMIT $3
"""

# {tsquery} is substituted ONLY with the two fixed identifiers below (never user input);
# the search text is always bound as $1, so this is injection-safe.
_LEXICAL_SQL = """
    SELECT id, text, source, doc_type, district,
           ts_rank_cd(tsv, query) AS rank
    FROM knowledge_base, {tsquery}('simple', $1) AS query
    WHERE tsv @@ query
      AND (doc_type = 'instruction' OR expires_at > now())
      AND ($2::text IS NULL OR district = $2 OR district IS NULL)
    ORDER BY rank DESC
    LIMIT $3
"""


def _to_result(row: asyncpg.Record, similarity: float) -> RetrievalResult:
    return RetrievalResult(
        id=row["id"],
        text=row["text"],
        source=row["source"],
        doc_type=row["doc_type"],
        district=row["district"],
        similarity=similarity,
    )


class KnowledgeRepository:
    def __init__(self, pool: asyncpg.Pool) -> None:
        self._pool = pool

    async def content_hash_exists(self, content_hash: str) -> bool:
        found = await self._pool.fetchval(
            "SELECT 1 FROM knowledge_base WHERE content_hash = $1 LIMIT 1", content_hash
        )
        logger.debug("content_hash_exists hash=%s… -> %s", content_hash[:8], found is not None)
        return found is not None

    async def upsert_chunks(self, document_id: str, chunks: list[ChunkRecord]) -> int:
        """Replace a document's chunks atomically: DELETE then bulk INSERT. Returns rows inserted."""
        records = [
            (c.document_id, c.chunk_index, c.text, c.embedding, c.doc_type,
             c.category, c.district, c.source, c.content_hash, c.expires_at)
            for c in chunks
        ]
        start = time.perf_counter()
        async with self._pool.acquire() as conn:
            async with conn.transaction():
                await conn.execute("DELETE FROM knowledge_base WHERE document_id = $1", document_id)
                await conn.executemany(_INSERT_SQL, records)
        logger.debug(
            "upsert_chunks doc=%s n=%d took %.1fms",
            document_id, len(records), (time.perf_counter() - start) * 1000,
        )
        return len(records)

    async def retrieve_dense(
        self, query_vec: np.ndarray, district_slug: str | None, limit: int = 10
    ) -> list[RetrievalResult]:
        start = time.perf_counter()
        async with self._pool.acquire() as conn:
            # CRITICAL: SET LOCAL must share the SAME explicit transaction as the SELECT.
            # asyncpg runs pooled connections in autocommit, so a bare execute("SET LOCAL …")
            # followed by fetch("SELECT …") would run in two separate transactions and the
            # settings would be silently discarded.
            async with conn.transaction():
                await conn.execute("SET LOCAL hnsw.ef_search = 100")
                await conn.execute("SET LOCAL hnsw.iterative_scan = 'relaxed_order'")
                await conn.execute("SET LOCAL hnsw.max_scan_tuples = 40000")
                rows = await conn.fetch(_DENSE_SQL, query_vec, district_slug, limit)
        logger.debug(
            "retrieve_dense rows=%d took %.1fms", len(rows), (time.perf_counter() - start) * 1000
        )
        return [_to_result(r, float(r["similarity"])) for r in rows]

    async def retrieve_lexical(
        self, query: str, district_slug: str | None, limit: int = 10
    ) -> list[RetrievalResult]:
        """Full-text leg (§2.8). websearch_to_tsquery primary; plainto_tsquery fallback on 0 rows."""
        start = time.perf_counter()
        rows = await self._pool.fetch(
            _LEXICAL_SQL.format(tsquery="websearch_to_tsquery"), query, district_slug, limit
        )
        if not rows:
            # plainto_tsquery is more forgiving for short / single-word queries.
            rows = await self._pool.fetch(
                _LEXICAL_SQL.format(tsquery="plainto_tsquery"), query, district_slug, limit
            )
        logger.debug(
            "retrieve_lexical rows=%d took %.1fms", len(rows), (time.perf_counter() - start) * 1000
        )
        # similarity=0.0 — ts_rank is not a cosine; fusion ranks the lexical leg by position.
        return [_to_result(r, 0.0) for r in rows]

    async def check_and_increment_rate_limit(self, user_id: str, max_per_minute: int) -> bool:
        """Atomic per-user fixed-window counter. Returns True when the request is allowed."""
        window_min = int(time.time()) // 60
        count = await self._pool.fetchval(
            """
            INSERT INTO rate_limit (user_id, window_min, count) VALUES ($1, $2, 1)
            ON CONFLICT (user_id, window_min)
            DO UPDATE SET count = rate_limit.count + 1
            RETURNING count
            """,
            user_id, window_min,
        )
        logger.debug("rate_limit user=%s window=%d count=%d", user_id, window_min, count)
        return count <= max_per_minute

    async def delete_expired(self) -> int:
        """Reaper sweep: delete rows past their TTL. Returns the number deleted."""
        start = time.perf_counter()
        rows = await self._pool.fetch(
            "DELETE FROM knowledge_base "
            "WHERE expires_at IS NOT NULL AND expires_at < now() RETURNING id"
        )
        logger.debug(
            "delete_expired removed=%d took %.1fms", len(rows), (time.perf_counter() - start) * 1000
        )
        return len(rows)
