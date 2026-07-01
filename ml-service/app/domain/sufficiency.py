"""
Purpose:   is_sufficient(dense, sim_gate, min_hits=1) -> bool. PURE stop-gate for the agent branch:
           does a sub-query's dense retrieval have enough distinct hits at-or-above sim_gate to
           stop, or should it be re-queried once? Bounds the agent loop without an LLM call.
           Distinct from confidence.py (which maps a single top-1 sim -> a user-facing band): this
           counts hits rather than classifying one score, but uses the SAME boundary confidence.py
           treats as "not no-info" (top1_sim >= sim_gate), so a sub-query judged sufficient here
           would also clear the shared tail's confidence gate later — the two modules agree on what
           counts as an acceptable match.
Layer:     domain
May import:   stdlib, schemas/retrieval (RetrievalResult); thresholds passed in (from config), not
              imported
Must NOT import:  api/*, services/*, components/*, pipeline/*; any I/O or model lib (asyncpg,
              openai, FastAPI)
"""
from __future__ import annotations

from app.schemas.retrieval import RetrievalResult


def is_sufficient(dense: list[RetrievalResult], sim_gate: float, min_hits: int = 1) -> bool:
    """
    True when at least `min_hits` chunks in the dense leg have similarity >= sim_gate.

    The boundary is inclusive at sim_gate, mirroring confidence.py's own choice (top1_sim ==
    sim_gate is NOT no-info): a hit sitting exactly on the gate is already "good enough" there, so
    it must count as sufficient here too, or the two gates would disagree on the same score.
    """
    hits = sum(1 for result in dense if result.similarity >= sim_gate)
    return hits >= min_hits
