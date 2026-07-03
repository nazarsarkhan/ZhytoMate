"""
Purpose:   Unit: _to_or_tsquery builds a valid OR tsquery from a natural-language question so the
           lexical retrieval leg can still contribute when websearch/plainto (which AND every term)
           match nothing. Pure string function — no DB.
Layer:     test
May import:   pytest, app.components.repository (the pure helper only)
Must NOT import:  a live asyncpg pool (the function under test touches no I/O)
"""
from __future__ import annotations

from app.components.repository import _to_or_tsquery


def test_ors_significant_terms_and_drops_short_stopwords() -> None:
    result = _to_or_tsquery("Що таке соціальна послуга «Догляд вдома»?")
    terms = result.split(" | ")

    assert " | " in result
    assert {"догляд", "вдома", "соціальна", "послуга"} <= set(terms)
    assert "що" not in terms  # 2-char stopword-ish token dropped


def test_dedupes_and_lowercases() -> None:
    assert _to_or_tsquery("Догляд догляд ДОГЛЯД") == "догляд"


def test_empty_when_only_short_or_numeric_tokens() -> None:
    assert _to_or_tsquery("як у на 2026 12") == ""
