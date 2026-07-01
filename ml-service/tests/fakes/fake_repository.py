"""
Purpose:   Minimal fake standing in for the KnowledgeRepository surface RagService actually calls:
           check_and_increment_rate_limit, retrieve_dense, retrieve_lexical. Duck-typed rather than a
           KnowledgeRepository subclass (that class is concrete, not a protocol) — good enough for
           RagService-level unit tests that shouldn't need a real Postgres pool. Returns the same
           canned dense/lexical lists for every call regardless of query text or district, since
           RagService-level tests only need to control whether retrieval is empty or not, not which
           specific chunk comes back.
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
        self._rate_limit_allowed = rate_limit_allowed
        self.rate_limit_calls: list[tuple[str, int]] = []

    async def check_and_increment_rate_limit(self, user_id: str, max_per_minute: int) -> bool:
        self.rate_limit_calls.append((user_id, max_per_minute))
        return self._rate_limit_allowed

    async def retrieve_dense(
        self, query_vec: np.ndarray, district_slug: str | None, limit: int = 10
    ) -> list[RetrievalResult]:
        return self._dense

    async def retrieve_lexical(
        self, query: str, district_slug: str | None, limit: int = 10
    ) -> list[RetrievalResult]:
        return self._lexical
