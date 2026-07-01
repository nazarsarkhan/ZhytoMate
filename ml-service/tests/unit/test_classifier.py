"""
Purpose:   Unit: classify_query() truth table — short single-intent -> SIMPLE; over-length, 2+
           question marks, and enumeration marker + >=6 words -> COMPLEX. Asserts purity and the
           bias toward SIMPLE.
Layer:     test
May import:   pytest, app.domain.classifier, stdlib
Must NOT import:  app.api, app.services, app.components, app.pipeline; asyncpg, google-genai
              (pure/fast unit test)
"""
from __future__ import annotations

from app.domain.classifier import QueryRoute, classify_query


def test_classify_simple() -> None:
    assert classify_query("Коли дадуть воду?") is QueryRoute.SIMPLE


def test_classify_complex_by_length() -> None:
    query = " ".join(["слово"] * 13)  # 13 words >= threshold
    assert classify_query(query) is QueryRoute.COMPLEX


def test_classify_complex_by_marker() -> None:
    # 6 words including the enumeration marker "та".
    assert classify_query("Коли буде вода та світло сьогодні") is QueryRoute.COMPLEX


def test_classify_complex_by_two_questions() -> None:
    assert classify_query("Коли вода? Коли світло?") is QueryRoute.COMPLEX


def test_marker_in_short_query_stays_simple() -> None:
    # "та" present but only 4 words (< 6) -> bias toward SIMPLE.
    assert classify_query("вода та світло") is QueryRoute.SIMPLE


def test_classify_is_pure() -> None:
    query = "Коли буде вода та світло сьогодні"
    assert classify_query(query) is classify_query(query)
