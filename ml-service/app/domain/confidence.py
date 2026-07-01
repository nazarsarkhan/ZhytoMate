"""
Purpose:   Map top-1 similarity -> confidence band (high / medium / no-info) using SIM_GATE /
           SIM_HIGH.
           Boundary semantics: sim_gate is EXCLUSIVE on the no-info side (top1_sim < sim_gate ->
           NO_INFO, so top1_sim == sim_gate is NOT no-info), matching rag_service's existing gate
           check. sim_high is INCLUSIVE (top1_sim >= sim_high -> HIGH), per SYSTEM_DESIGN's stated
           "≥ SIM_HIGH -> high" convention. If sim_gate == sim_high the MEDIUM band is unreachable
           (every value is either NO_INFO or HIGH) — this is intentional, not an error.
Layer:     domain
May import:   stdlib, schemas/common
Must NOT import:  api/*, services/*, components/*; any I/O or model lib (asyncpg, google-genai,
              sentence-transformers, FastAPI). Thresholds are passed in (sourced from config), not
              imported.
"""
from __future__ import annotations

from enum import StrEnum


class ConfidenceBand(StrEnum):
    HIGH = "high"
    MEDIUM = "medium"
    NO_INFO = "no_info"


def confidence_band(top1_sim: float, sim_gate: float, sim_high: float) -> ConfidenceBand:
    """Classify the dense top-1 cosine similarity into a confidence band. Pure — no I/O, no config
    import; thresholds are always passed in by the caller."""
    if top1_sim < sim_gate:
        return ConfidenceBand.NO_INFO
    if top1_sim >= sim_high:
        return ConfidenceBand.HIGH
    return ConfidenceBand.MEDIUM
