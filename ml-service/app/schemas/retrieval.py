"""
Purpose:   Retrieval transfer types shared across layers: RetrievalResult (one retrieved chunk,
           dense or lexical) and RetrievalOutcome (the dense leg + the RRF-fused leg together).
           Lives in schemas — not components/repository — so app.protocols (which may only import
           schemas/domain types, never components/*) can type Retriever.retrieve()'s return value.
           RetrievalOutcome.dense_top1_sim preserves the load-bearing distinction the confidence
           gate relies on: the dense-only top-1 cosine, never the RRF-fused order/score.
Layer:     schema
May import:   stdlib (dataclasses)
Must NOT import:  api/*, services/*, components/*, domain/*; any I/O or model lib (asyncpg, FastAPI
              routing)
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class RetrievalResult:
    """One retrieved chunk (internal transfer)."""

    id: int
    text: str
    source: str
    doc_type: str
    district: str | None
    similarity: float                # cosine [0,1] for the dense leg; 0.0 for the lexical leg


@dataclass
class RetrievalOutcome:
    """Both legs of a hybrid retrieval call: the dense-only list (confidence gate) and the RRF-fused
    list (context selection). Kept as separate fields rather than collapsing to one list, since the
    two orderings answer different questions and must never be conflated (see module docstring)."""

    dense: list[RetrievalResult]
    fused: list[RetrievalResult]

    @property
    def dense_top1_sim(self) -> float:
        return self.dense[0].similarity if self.dense else 0.0
