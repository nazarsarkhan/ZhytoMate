"""
Purpose:   Retrieval transfer types shared across layers: RetrievalResult (one retrieved chunk,
           dense or lexical) and RetrievalOutcome (the dense leg + the RRF-fused leg + the raw
           lexical leg together). Lives in schemas — not components/repository — so app.protocols
           (which may only import schemas/domain types, never components/*) can type
           Retriever.retrieve()'s return value. RetrievalOutcome.dense_top1_sim preserves the
           load-bearing distinction the confidence gate relies on: the dense-only top-1 cosine,
           never the RRF-fused order/score. RetrievalOutcome.lexical (and its lexical_top1_id
           convenience property) exists for a second, complementary gating signal: dense cosine
           similarity is a structurally weak fit for short, keyword-heavy factual queries (e.g.
           "Де ЦНАП?") even against a directly-relevant chunk, but that same chunk is often
           trivially the lexical leg's own #1 keyword match. run_shared_tail's strong_lexical_match
           check (pipeline/base.py) reads lexical_top1_id to detect exactly that case — a genuine
           rank-1 agreement between the fused list and the raw lexical leg — without needing any
           new calibrated numeric threshold.
Layer:     schema
May import:   stdlib (dataclasses)
Must NOT import:  api/*, services/*, components/*, domain/*; any I/O or model lib (asyncpg, FastAPI
              routing)
"""
from __future__ import annotations

from dataclasses import dataclass, field


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
    """Three views of a hybrid retrieval call: the dense-only list (confidence gate), the RRF-fused
    list (context selection), and the raw lexical-only list (the second confidence-gate signal —
    see module docstring). Kept as separate fields rather than collapsing to one list, since the
    orderings answer different questions and must never be conflated. `lexical` defaults to empty
    so existing call sites/tests that only ever cared about dense+fused keep working unchanged."""

    dense: list[RetrievalResult]
    fused: list[RetrievalResult]
    lexical: list[RetrievalResult] = field(default_factory=list)

    @property
    def dense_top1_sim(self) -> float:
        return self.dense[0].similarity if self.dense else 0.0

    @property
    def lexical_top1_id(self) -> int | None:
        return self.lexical[0].id if self.lexical else None
