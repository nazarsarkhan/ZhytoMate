"""
Purpose:   Unit: _significant_terms extracts the distinct, non-trivial tokens a query contributes to
           the lexical OR fallback. NOTE: a corpus-frequency filter on top of this was planned
           (originally referenced here and in repository.py as `KnowledgeRepository
           ._distinctive_terms`) but never actually built — there is no such method anywhere in
           this codebase. The current mitigation for the resulting risk (the OR fallback anchoring
           on a single corpus-common word) lives one layer up: retrieve_lexical tags OR-fallback
           hits with their real lexical_coverage, and RetrievalOutcome.has_strong_lexical_match
           requires coverage >= 2 to trust one. See ml-service/CLAUDE.md's Known Issues for the
           full history. Pure string function — no DB.
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
