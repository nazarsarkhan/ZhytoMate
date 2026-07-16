"""
Purpose:   Minimal fake standing in for the KnowledgeRepository surface RagService and
           IngestService actually call: incr_rate_limit_counter, retrieve_dense, retrieve_lexical
           (RagService); content_hash_exists, upsert_chunks (IngestService). Duck-typed rather than
           a KnowledgeRepository subclass (that class is concrete, not a protocol) — good enough for
           service-level unit tests that shouldn't need a real Postgres pool. Returns the same
           canned dense/lexical lists for every call regardless of query text or district, since
           RagService-level tests only need to control whether retrieval is empty or not, not which
           specific chunk comes back. rate_limit_allowed toggles whether the returned counter value
           reads as allowed or denied once RagService runs it through rate_limiter.evaluate().
           content_hash_exists toggles the dedup branch IngestService checks before embedding.
Layer:     test
May import:   stdlib, numpy, app.schemas.retrieval, app.components.repository (ChunkRecord — a
              plain dataclass, not a live DB dependency)
Must NOT import:  asyncpg, pgvector (the whole point is to avoid a real DB in unit tests)
"""
from __future__ import annotations

import numpy as np

from app.components.repository import ChunkRecord
from app.schemas.retrieval import RetrievalResult


class FakeKnowledgeRepository:
    def __init__(
        self,
        *,
        dense: list[RetrievalResult] | None = None,
        lexical: list[RetrievalResult] | None = None,
        rate_limit_allowed: bool = True,
        content_hash_exists: bool = False,
    ) -> None:
        self._dense = dense or []
        self._lexical = lexical or []
        # Counts as 1 (well under any real max_per_minute) when allowed, or an effectively
        # unbounded count when denied — evaluate() only cares about count vs. max_per_minute.
        self._rate_limit_count = 1 if rate_limit_allowed else 10**9
        self._content_hash_exists = content_hash_exists
        self.rate_limit_calls: list[tuple[str, int]] = []
        self.upsert_calls: list[tuple[str, list[ChunkRecord]]] = []

    async def incr_rate_limit_counter(self, hashed_key: str, window_min: int) -> int:
        self.rate_limit_calls.append((hashed_key, window_min))
        return self._rate_limit_count

    async def retrieve_dense(
        self, query_vec: np.ndarray, district_slug: str | None, limit: int = 10,
        category: str | None = None,
    ) -> list[RetrievalResult]:
        return self._dense

    async def retrieve_lexical(
        self, query: str, district_slug: str | None, limit: int = 10,
        category: str | None = None,
    ) -> list[RetrievalResult]:
        return self._lexical

    async def content_hash_exists(self, content_hash: str) -> bool:
        return self._content_hash_exists

    async def upsert_chunks(self, document_id: str, chunks: list[ChunkRecord]) -> int:
        self.upsert_calls.append((document_id, chunks))
        return len(chunks)
