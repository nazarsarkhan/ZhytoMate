"""
Purpose:   Scriptable fake implementing protocols.Retriever: construct with a dict mapping exact
           query_text -> a canned RetrievalOutcome. retrieve() looks up the outcome by the query_text
           it was actually given, so a test can script distinct results for an original sub-query and
           its rewritten form (both are just different strings in the same dict) — this matters for
           AgentRAGPipeline, which calls retrieve() once per sub-query and again for any rewrite.
           Any query_text not present in the dict returns an empty RetrievalOutcome rather than
           raising, so an under-specified test degrades to the no-info path instead of crashing.
Layer:     test
May import:   stdlib, numpy, app.protocols (Retriever), app.schemas.retrieval
Must NOT import:  asyncpg, pgvector (the whole point is to avoid a real DB in unit tests)
"""
from __future__ import annotations

import numpy as np

from app.protocols import Retriever
from app.schemas.retrieval import RetrievalOutcome

_EMPTY_OUTCOME = RetrievalOutcome(dense=[], fused=[])


class FakeRetriever(Retriever):
    """Records every call as (query_text, district, k) for call-order/count assertions."""

    def __init__(self, outcomes: dict[str, RetrievalOutcome]) -> None:
        self._outcomes = outcomes
        self.calls: list[tuple[str, str | None, int]] = []

    async def retrieve(
        self, query_text: str, query_vec: np.ndarray, district: str | None, k: int
    ) -> RetrievalOutcome:
        self.calls.append((query_text, district, k))
        return self._outcomes.get(query_text, _EMPTY_OUTCOME)
