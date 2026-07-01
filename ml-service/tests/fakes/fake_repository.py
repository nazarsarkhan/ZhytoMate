"""
Purpose:   Minimal fake standing in for the KnowledgeRepository surface RagService actually calls:
           incr_rate_limit_counter, retrieve_dense, retrieve_lexical. Duck-typed rather than a
           KnowledgeRepository subclass (that class is concrete, not a protocol) — good enough for
           RagService-level unit tests that shouldn't need a real Postgres pool. Returns the same
           canned dense/lexical lists for every call regardless of query text or district, since
           RagService-level tests only need to control whether retrieval is empty or not, not which
           specific chunk comes back. rate_limit_allowed toggles whether the returned counter value
           reads as allowed or denied once RagService runs it through rate_limiter.evaluate().
Layer:     test
May import:   stdlib, numpy, app.schemas.retrieval
Must NOT import:  asyncpg, pgvector (the whole point is to avoid a real DB in unit tests)
"""
from __future__ import annotations

import numpy as np

from app.schemas.retrieval import RetrievalResult


class FakeKnowledgeRepository:
    def __init__(
        self,
        *,
        dense: list[RetrievalResult] | None = None,
        lexical: list[RetrievalResult] | None = None,
        rate_limit_allowed: bool = True,
    ) -> None:
        self._dense = dense or []
        self._lexical = lexical or []
        # Counts as 1 (well under any real max_per_minute) when allowed, or an effectively
        # unbounded count when denied — evaluate() only cares about count vs. max_per_minute.
        self._rate_limit_count = 1 if rate_limit_allowed else 10**9
        self.rate_limit_calls: list[tuple[str, int]] = []

    async def incr_rate_limit_counter(self, hashed_key: str, window_min: int) -> int:
        self.rate_limit_calls.append((hashed_key, window_min))
        return self._rate_limit_count

    async def retrieve_dense(
        self, query_vec: np.ndarray, district_slug: str | None, limit: int = 10
    ) -> list[RetrievalResult]:
        return self._dense

    async def retrieve_lexical(
        self, query: str, district_slug: str | None, limit: int = 10
    ) -> list[RetrievalResult]:
        return self._lexical
