"""
Purpose:   Unit: _significant_terms extracts the distinct, non-trivial tokens a query contributes to
           the lexical OR fallback (the corpus-frequency filtering on top of it lives in
           KnowledgeRepository._distinctive_terms and is exercised by the integration suite). Pure
           string function — no DB.
Layer:     test
May import:   pytest, app.components.repository (the pure helper only)
Must NOT import:  a live asyncpg pool (the function under test touches no I/O)
"""
from __future__ import annotations

from app.components.repository import _significant_terms


def test_extracts_significant_terms_and_drops_short_stopwords() -> None:
    terms = _significant_terms("Що таке соціальна послуга «Догляд вдома»?")

    assert {"догляд", "вдома", "соціальна", "послуга"} <= set(terms)
    assert "що" not in terms  # 2-char stopword-ish token dropped


def test_dedupes_and_lowercases() -> None:
    assert _significant_terms("Догляд догляд ДОГЛЯД") == ["догляд"]


def test_empty_when_only_short_or_numeric_tokens() -> None:
    assert _significant_terms("як у на 2026 12") == []
