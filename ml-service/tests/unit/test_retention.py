"""
Purpose:   Unit: the evergreen-category retention policy (§2.5) — memorial news is permanent
           (never expires), time-bound categories and untagged items are not. Guards the closed
           EVERGREEN_CATEGORIES vocabulary the ingest expiry decision relies on.
Layer:     test
May import:   pytest, app.domain.retention
Must NOT import:  real asyncpg, real openai
"""
from __future__ import annotations

from app.domain.retention import EVERGREEN_CATEGORIES, is_evergreen_news


def test_memorial_is_evergreen_case_insensitively() -> None:
    assert is_evergreen_news("memorial") is True
    assert is_evergreen_news("Memorial") is True


def test_time_bound_and_missing_categories_are_not_evergreen() -> None:
    assert is_evergreen_news("transport") is False
    assert is_evergreen_news("utilities") is False
    assert is_evergreen_news(None) is False
    assert is_evergreen_news("") is False


def test_evergreen_vocabulary_contains_memorial() -> None:
    assert "memorial" in EVERGREEN_CATEGORIES
