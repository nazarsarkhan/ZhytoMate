"""
Purpose:   Unit tests for the pure rate-limit policy (hash_user_id, current_window, evaluate) —
           no Postgres, no FastAPI. Locks in two things that matter beyond "it works": the
           boundary semantics of evaluate() must exactly match the OLD inline
           `count <= max_per_minute` check it replaced, and hash_user_id must produce a real
           64-char sha256 digest (the DB key), not the 8-char prefix RagService uses for logs.
Layer:     test
May import:   pytest, app.components.rate_limiter, stdlib
Must NOT import:  asyncpg, FastAPI
"""
from __future__ import annotations

from app.components import rate_limiter
from app.components.rate_limiter import current_window, evaluate, hash_user_id


def test_hash_user_id_is_deterministic() -> None:
    assert hash_user_id("12345") == hash_user_id("12345")


def test_hash_user_id_is_a_full_64_char_hex_digest() -> None:
    digest = hash_user_id("12345")
    assert len(digest) == 64
    assert all(c in "0123456789abcdef" for c in digest)


def test_hash_user_id_differs_for_different_inputs() -> None:
    assert hash_user_id("12345") != hash_user_id("67890")


def test_evaluate_allows_at_exact_limit() -> None:
    # Matches the OLD repository code's `count <= max_per_minute` boundary exactly.
    decision = evaluate(count=10, max_per_minute=10)
    assert decision.allowed is True
    assert decision.retry_after is None


def test_evaluate_denies_one_over_limit() -> None:
    decision = evaluate(count=11, max_per_minute=10)
    assert decision.allowed is False
    assert decision.retry_after == 60


def test_current_window_returns_an_int() -> None:
    assert isinstance(current_window(), int)


def test_current_window_advances_with_time(monkeypatch) -> None:
    fake_now = 1_000_000.0
    monkeypatch.setattr(rate_limiter.time, "time", lambda: fake_now)
    first = current_window()

    monkeypatch.setattr(rate_limiter.time, "time", lambda: fake_now + 60)
    second = current_window()

    assert second == first + 1


def test_current_window_matches_the_documented_formula(monkeypatch) -> None:
    fake_now = 1_700_000_123.456
    monkeypatch.setattr(rate_limiter.time, "time", lambda: fake_now)
    assert current_window() == int(fake_now) // 60
