"""
Purpose:   Unit: normalize/clean is stable and the sha256 content_hash is identical for
           semantically-identical input but differs on real content change (§2.4 dedup key).
Layer:     test
May import:   pytest, app.domain.text, stdlib
Must NOT import:  app.api, app.services, app.components; asyncpg, google-genai (pure/fast unit test)
"""
from __future__ import annotations

from app.domain.text import compute_content_hash, normalize_text


def test_normalize_collapses_whitespace_but_keeps_paragraphs() -> None:
    assert normalize_text("a\t b c") == "a b c"
    assert normalize_text("p1\n\n\n\np2") == "p1\n\np2"
    assert normalize_text("  trim me  ") == "trim me"


def test_empty_input_is_empty() -> None:
    assert normalize_text("") == ""


def test_hash_is_stable_across_irrelevant_whitespace() -> None:
    a = compute_content_hash("Коли дадуть   воду?")
    b = compute_content_hash("Коли дадуть\tводу?")
    assert a == b


def test_hash_changes_on_real_content_change() -> None:
    assert compute_content_hash("water on monday") != compute_content_hash("water on tuesday")


def test_hash_is_64_char_lowercase_hex() -> None:
    digest = compute_content_hash("any text")
    assert len(digest) == 64
    assert digest == digest.lower()
    assert all(char in "0123456789abcdef" for char in digest)
