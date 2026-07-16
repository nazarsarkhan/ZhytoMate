"""
Purpose:   Scriptable fake implementing protocols.Retriever: construct with a dict mapping exact
           query_text -> either a canned RetrievalOutcome or an exception instance to raise.
           retrieve() looks up the entry by the query_text it was actually given, so a test can
           script distinct results for an original sub-query and its rewritten form (both are just
           different strings in the same dict) — this matters for AgentRAGPipeline, which calls
           retrieve() once per sub-query and again for any rewrite. Mapping a query_text to an
           exception instance lets a test simulate a transient retrieval failure (e.g. a Postgres
           blip) for one sub-query while the others still resolve normally — mirrors the
           tuple-or-exception scripting already used by FakeGenerator. Any query_text not present
           in the dict returns an empty RetrievalOutcome rather than raising, so an under-specified
           test degrades to the no-info path instead of crashing.
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

    def __init__(self, outcomes: dict[str, RetrievalOutcome | BaseException]) -> None:
        self._outcomes = outcomes
        self.calls: list[tuple[str, str | None, int]] = []

    async def retrieve(
        self, query_text: str, query_vec: np.ndarray, district: str | None, k: int,
        category: str | None = None,
    ) -> RetrievalOutcome:
        self.calls.append((query_text, district, k))
        outcome = self._outcomes.get(query_text, _EMPTY_OUTCOME)
        if isinstance(outcome, BaseException):
            raise outcome
        return outcome
