"""
Purpose:   Unit: top-1 similarity maps to the correct band across SIM_GATE / SIM_HIGH boundaries
           (incl. exact-edge values).
Layer:     test
May import:   pytest, app.domain.confidence, stdlib
Must NOT import:  app.api, app.services, app.components; asyncpg, google-genai (pure/fast unit test)
"""
from __future__ import annotations

import pytest

from app.domain.confidence import ConfidenceBand, confidence_band

_SIM_GATE = 0.70
_SIM_HIGH = 0.80


@pytest.mark.parametrize(
    ("top1_sim", "expected"),
    [
        (0.0, ConfidenceBand.NO_INFO),
        (0.5, ConfidenceBand.NO_INFO),
        (0.69, ConfidenceBand.NO_INFO),
        # exactly at sim_gate: NOT no-info (matches rag_service's `<` gate today)
        (0.70, ConfidenceBand.MEDIUM),
        (0.75, ConfidenceBand.MEDIUM),
        (0.79, ConfidenceBand.MEDIUM),
        (0.80, ConfidenceBand.HIGH),  # exactly at sim_high: HIGH (>= is inclusive)
        (0.95, ConfidenceBand.HIGH),
        (1.0, ConfidenceBand.HIGH),
    ],
)
def test_confidence_band_boundaries(top1_sim: float, expected: ConfidenceBand) -> None:
    assert confidence_band(top1_sim, sim_gate=_SIM_GATE, sim_high=_SIM_HIGH) is expected


def test_confidence_band_degenerate_equal_thresholds_has_no_medium_band() -> None:
    # sim_gate == sim_high: nothing in Settings prevents this. The MEDIUM band must collapse to
    # nothing (every value is either NO_INFO or HIGH, never MEDIUM).
    assert confidence_band(0.5, sim_gate=0.80, sim_high=0.80) is ConfidenceBand.NO_INFO
    assert confidence_band(0.79, sim_gate=0.80, sim_high=0.80) is ConfidenceBand.NO_INFO
    assert confidence_band(0.80, sim_gate=0.80, sim_high=0.80) is ConfidenceBand.HIGH
    assert confidence_band(1.0, sim_gate=0.80, sim_high=0.80) is ConfidenceBand.HIGH
