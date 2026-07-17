"""
Purpose:   asyncpg pool (register_vector in the init callback) + KnowledgeRepository:
           content-hash check, idempotent upsert (DELETE + executemany in one tx), dense
           retrieval (SET LOCAL hnsw.* MUST share the SAME tx as the SELECT — asyncpg autocommit
           would discard them), lexical retrieval (websearch->plainto fallback), the Postgres
           rate-limit counter (pure persistence — incr_rate_limit_counter; allow/deny policy lives
           in components/rate_limiter, composed by RagService), and TTL delete + stale rate-limit
           window sweep for the reaper. Internal dataclass ChunkRecord (ingest-time transfer,
           stays here). RetrievalResult lives in app.schemas.retrieval — the port abstraction in
           app.protocols needs it and may not import components/*.
Layer:     component (repository)
May import:   app.config (types), app.schemas.retrieval, stdlib, numpy, asyncpg, pgvector, structlog
Must NOT import:  services/*, api/*, pipeline/*, other components/*; FastAPI
"""
from __future__ import annotations

import re
import time
from dataclasses import dataclass
from datetime import datetime

import asyncpg
import numpy as np
import structlog
from pgvector.asyncpg import register_vector

from app.config import Settings
from app.schemas.retrieval import RetrievalResult

logger = structlog.get_logger(__name__)


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
    doc_type: str                    # 'news' | 'document' | legacy 'instruction'
    category: str | None
    district: str | None             # canonical slug or None (city-wide)
    source: str
    content_hash: str                # sha256 hex, 64 chars
    expires_at: datetime | None      # None for document/instruction


_INSERT_SQL = """
    INSERT INTO knowledge_base
        (document_id, chunk_index, text, embedding, doc_type,
         category, district, source, content_hash, expires_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
"""

_DENSE_SQL = """
    SELECT id, text, source, doc_type, category, district,
           1 - (embedding <=> $1::vector) AS similarity
    FROM knowledge_base
    WHERE (expires_at IS NULL OR expires_at > now())
      AND ($2::text IS NULL OR district = $2 OR district IS NULL)
      AND ($4::text IS NULL OR category = $4)
    ORDER BY embedding <=> $1::vector
    LIMIT $3
"""

# {tsquery} is substituted ONLY with the two fixed identifiers below (never user input);
# the search text is always bound as $1, so this is injection-safe.
_LEXICAL_SQL = """
    SELECT id, text, source, doc_type, category, district,
           ts_rank_cd(tsv, query) AS rank
    FROM knowledge_base, {tsquery}('simple', $1) AS query
    WHERE tsv @@ query
      AND (expires_at IS NULL OR expires_at > now())
      AND ($2::text IS NULL OR district = $2 OR district IS NULL)
      AND ($4::text IS NULL OR category = $4)
    ORDER BY rank DESC
    LIMIT $3
"""

# OR fallback ($1 = "a | b | c" tsquery, $4 = the same terms as an array). Ranks by how many
# DISTINCT query terms a chunk covers, so a chunk mentioning several of the words beats one that
# just repeats a single common word (e.g. a price list full of "послуга"); ts_rank_cd breaks ties.
_OR_LEXICAL_SQL = """
    SELECT id, text, source, doc_type, category, district,
           (SELECT count(*) FROM unnest($4::text[]) AS term
            WHERE tsv @@ plainto_tsquery('simple', term)) AS coverage
    FROM knowledge_base, to_tsquery('simple', $1) AS query
    WHERE tsv @@ query
      AND (expires_at IS NULL OR expires_at > now())
      AND ($2::text IS NULL OR district = $2 OR district IS NULL)
      AND ($5::text IS NULL OR category = $5)
    ORDER BY coverage DESC, ts_rank_cd(tsv, query) DESC
    LIMIT $3
"""


def _to_result(
    row: asyncpg.Record,
    similarity: float,
    lexical_coverage: int | None = None,
    lexical_terms_total: int | None = None,
) -> RetrievalResult:
    return RetrievalResult(
        id=row["id"],
        text=row["text"],
        source=row["source"],
        doc_type=row["doc_type"],
        district=row["district"],
        similarity=similarity,
        category=row.get("category") if hasattr(row, "get") else row["category"],
        lexical_coverage=lexical_coverage,
        lexical_terms_total=lexical_terms_total,
    )


# Letters-only tokens of length >= 3 — drops stopword-ish short words and digits. Letters only, so
# the joined result is always a syntactically valid to_tsquery input (no operators to escape).
_TSQUERY_WORD = re.compile(r"[^\W\d_]{3,}", re.UNICODE)
_LEXICAL_STOPWORDS = frozenset(
    {
        "хто", "кто", "who", "що", "что", "what", "де", "где", "where",
        "коли", "когда", "when", "який", "яка", "какой", "какая", "which",
        "як", "как", "how",
    }
)
_LEXICAL_STOPWORD_RE = re.compile(
    r"\b(?:" + "|".join(re.escape(word) for word in _LEXICAL_STOPWORDS) + r")\b",
    re.IGNORECASE,
)


def _lexical_query(query: str) -> str:
    """Remove interrogative filler before PostgreSQL's AND lexical search."""
    return _LEXICAL_STOPWORD_RE.sub(" ", query).strip()


def _significant_terms(query: str) -> list[str]:
    """Distinct >=3-letter tokens from a query (drops short stopword-ish words and digits),
    order-preserving. The raw material for the lexical OR fallback.

    NOTE: a corpus-frequency filter on top of this (originally planned as
    KnowledgeRepository._distinctive_terms, referenced here and in test_tsquery.py's docstring)
    was never actually built — there is no such method anywhere in this codebase. This is exactly
    why the OR fallback can anchor on a single corpus-common word (e.g. "українського") for a
    query whose real subject has zero KB overlap. The current mitigation lives one layer up, at
    the confidence gate: retrieve_lexical tags each OR-fallback RetrievalResult with its real
    lexical_coverage int and lexical_terms_total (len(terms) here), and
    RetrievalOutcome.has_strong_lexical_match (schemas/retrieval.py) requires FULL coverage
    (lexical_coverage == lexical_terms_total) before trusting an OR-fallback hit — not merely an
    absolute minimum count, which can't distinguish a short query's only significant term
    (coverage=1 of 1, a complete match) from one matching word out of several in a verbose,
    off-topic query (coverage=1 of 3+, a partial one). A real corpus-frequency filter here (so
    `_significant_terms` itself never offers up an overly-common word as OR-fallback bait in the
    first place) remains a follow-up — see ml-service/CLAUDE.md's Known Issues."""
    seen: list[str] = []
    for token in _TSQUERY_WORD.findall(query.lower()):
        if token in _LEXICAL_STOPWORDS:
            continue
        if token not in seen:
            seen.append(token)
    return seen[:12]


class KnowledgeRepository:
    def __init__(self, pool: asyncpg.Pool) -> None:
        self._pool = pool

    async def content_hash_exists(self, content_hash: str) -> bool:
        found = await self._pool.fetchval(
            "SELECT 1 FROM knowledge_base WHERE content_hash = $1 LIMIT 1", content_hash
        )
        logger.debug("content_hash_exists", hash_prefix=content_hash[:8], exists=found is not None)
        return found is not None

    async def upsert_chunks(self, document_id: str, chunks: list[ChunkRecord]) -> int:
        """Replace a document's chunks atomically: DELETE then bulk INSERT. Returns rows
        inserted."""
        records = [
            (c.document_id, c.chunk_index, c.text, c.embedding, c.doc_type,
             c.category, c.district, c.source, c.content_hash, c.expires_at)
            for c in chunks
        ]
        start = time.perf_counter()
        async with self._pool.acquire() as conn, conn.transaction():
            await conn.execute("DELETE FROM knowledge_base WHERE document_id = $1", document_id)
            await conn.executemany(_INSERT_SQL, records)
        logger.debug(
            "upsert_chunks",
            doc=document_id,
            n=len(records),
            took_ms=round((time.perf_counter() - start) * 1000, 1),
        )
        return len(records)

    async def delete_document(self, document_id: str) -> int:
        """Delete all chunks for a document. Returns the number deleted (0 if document_id
        absent)."""
        start = time.perf_counter()
        rows = await self._pool.fetch(
            "DELETE FROM knowledge_base WHERE document_id = $1 RETURNING id", document_id
        )
        logger.debug(
            "delete_document doc=%s removed=%d took %.1fms",
            document_id, len(rows), (time.perf_counter() - start) * 1000,
        )
        return len(rows)

    async def retrieve_dense(
        self, query_vec: np.ndarray, district_slug: str | None, limit: int = 10,
        category: str | None = None,
    ) -> list[RetrievalResult]:
        start = time.perf_counter()
        # CRITICAL: SET LOCAL must share the SAME explicit transaction as the SELECT.
        # asyncpg runs pooled connections in autocommit, so a bare execute("SET LOCAL …")
        # followed by fetch("SELECT …") would run in two separate transactions and the
        # settings would be silently discarded.
        async with self._pool.acquire() as conn, conn.transaction():
            await conn.execute("SET LOCAL hnsw.ef_search = 100")
            await conn.execute("SET LOCAL hnsw.iterative_scan = 'relaxed_order'")
            await conn.execute("SET LOCAL hnsw.max_scan_tuples = 40000")
            rows = await conn.fetch(_DENSE_SQL, query_vec, district_slug, limit, category)
        logger.debug(
            "retrieve_dense", rows=len(rows), took_ms=round((time.perf_counter() - start) * 1000, 1)
        )
        return [_to_result(r, float(r["similarity"])) for r in rows]

    async def retrieve_lexical(
        self, query: str, district_slug: str | None, limit: int = 10,
        category: str | None = None,
    ) -> list[RetrievalResult]:
        """Full-text leg (§2.8). websearch_to_tsquery primary; plainto_tsquery fallback on 0
        rows; coverage-ranked OR fallback when both AND queries are empty. AND-tier hits carry
        lexical_coverage=lexical_terms_total=None (an all-or-nothing match needs no partial-
        coverage caveat); only OR-fallback hits carry their real coverage int and the query's total
        significant-term count, so callers (see
        schemas.retrieval.RetrievalOutcome.has_strong_lexical_match) can tell a FULL match (a short
        query's only significant term, fully covered) from a partial, degenerate one (one common
        word out of several, in an otherwise off-topic query) — a plain minimum coverage count
        can't tell those two apart, since both can read coverage=1."""
        start = time.perf_counter()
        lexical_query = _lexical_query(query)
        rows = await self._pool.fetch(
            _LEXICAL_SQL.format(tsquery="websearch_to_tsquery"),
            lexical_query,
            district_slug,
            limit,
            category,
        )
        if not rows:
            # plainto_tsquery is more forgiving for short / single-word queries.
            rows = await self._pool.fetch(
                _LEXICAL_SQL.format(tsquery="plainto_tsquery"),
                lexical_query,
                district_slug,
                limit,
                category,
            )
        coverage_by_id: dict[int, int] = {}
        terms_total: int | None = None
        if not rows:
            # Both of the above AND every term, so a verbose question matches no single chunk. Fall
            # back to an OR of the significant terms, ranked by how many DISTINCT terms each chunk
            # covers so a chunk mentioning several of the words beats one repeating a common filler.
            terms = _significant_terms(lexical_query)
            if terms:
                rows = await self._pool.fetch(
                    _OR_LEXICAL_SQL, " | ".join(terms), district_slug, limit, terms, category
                )
                coverage_by_id = {row["id"]: row["coverage"] for row in rows}
                terms_total = len(terms)
        logger.debug(
            "retrieve_lexical",
            rows=len(rows),
            took_ms=round((time.perf_counter() - start) * 1000, 1),
        )
        # similarity=0.0 — ts_rank is not a cosine; fusion ranks the lexical leg by position.
        # lexical_coverage/lexical_terms_total come from coverage_by_id/terms_total, which stay
        # empty/None (every .get() -> None) unless the OR-fallback tier is what actually produced
        # these rows.
        return [
            _to_result(
                r, 0.0,
                lexical_coverage=coverage_by_id.get(r["id"]),
                lexical_terms_total=terms_total,
            )
            for r in rows
        ]

    async def incr_rate_limit_counter(self, hashed_key: str, window_min: int) -> int:
        """Atomic per-key fixed-window counter (upsert + increment). Returns the count AFTER this
        increment — the caller (RagService, via rate_limiter.evaluate) decides allow/deny."""
        count = await self._pool.fetchval(
            """
            INSERT INTO rate_limit (user_id, window_min, count) VALUES ($1, $2, 1)
            ON CONFLICT (user_id, window_min)
            DO UPDATE SET count = rate_limit.count + 1
            RETURNING count
            """,
            hashed_key, window_min,
        )
        logger.debug("rate_limit", key_prefix=hashed_key[:8], window=window_min, count=count)
        return count

    async def delete_expired(self) -> int:
        """Reaper sweep: delete rows past their TTL. Returns the number deleted."""
        start = time.perf_counter()
        rows = await self._pool.fetch(
            "DELETE FROM knowledge_base "
            "WHERE expires_at IS NOT NULL AND expires_at < now() RETURNING id"
        )
        logger.debug(
            "delete_expired",
            removed=len(rows),
            took_ms=round((time.perf_counter() - start) * 1000, 1),
        )
        return len(rows)

    async def delete_stale_rate_limit_windows(self, older_than_minutes: int = 5) -> int:
        """Reaper sweep: delete rate_limit rows whose window is older than `older_than_minutes`
        minutes ago. Returns the number of rows deleted."""
        start = time.perf_counter()
        # Same `int(time.time()) // 60` formula as rate_limiter.current_window() — recomputed
        # here rather than imported, since this module's contract forbids importing other
        # components (RagService is what wires the two together).
        cutoff_window = int(time.time()) // 60 - older_than_minutes
        rows = await self._pool.fetch(
            "DELETE FROM rate_limit WHERE window_min < $1 RETURNING window_min", cutoff_window
        )
        logger.debug(
            "delete_stale_rate_limit_windows",
            removed=len(rows),
            took_ms=round((time.perf_counter() - start) * 1000, 1),
        )
        return len(rows)
