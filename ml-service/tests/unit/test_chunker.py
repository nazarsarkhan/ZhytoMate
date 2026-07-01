"""
Purpose:   Unit: chunker honours target 300 / hard-max 400 / overlap 50 token boundaries, packs
           toward the target as the normal stopping point, and never exceeds the hard cap except via
           a single oversized sentence. Tokens are faked as whitespace-words so the test is pure and
           fast.
Layer:     test
May import:   pytest, app.domain.chunker, stdlib
Must NOT import:  app.api, app.services, app.components; asyncpg, google-genai (pure/fast unit test)
"""
from __future__ import annotations

from app.domain.chunker import (
    HARD_MAX_TOKENS,
    SINGLE_CHUNK_THRESHOLD,
    TARGET_TOKENS,
    chunk_text,
)


def _count_words(text: str) -> int:
    """Fake tokenizer: one token per whitespace word (deterministic, additive)."""
    return len(text.split())


def _sentences(word_count: int, words_per_sentence: int = 10) -> str:
    """Build text of exactly `word_count` words grouped into period-terminated sentences."""
    words = [f"w{i}" for i in range(word_count)]
    sentences = [
        " ".join(words[i : i + words_per_sentence])
        for i in range(0, word_count, words_per_sentence)
    ]
    return ". ".join(sentences) + "."


def test_small_doc_is_single_chunk() -> None:
    text = _sentences(10)
    chunks = chunk_text(text, _count_words)
    assert len(chunks) == 1
    assert chunks[0] == text.strip()


def test_doc_at_threshold_is_not_split() -> None:
    text = _sentences(SINGLE_CHUNK_THRESHOLD)
    assert len(chunk_text(text, _count_words)) == 1


def test_large_doc_splits_into_capped_chunks() -> None:
    chunks = chunk_text(_sentences(600), _count_words)
    assert len(chunks) >= 2
    assert all(_count_words(chunk) <= HARD_MAX_TOKENS for chunk in chunks)
    assert all(chunk.strip() == chunk and chunk for chunk in chunks)


def test_consecutive_chunks_overlap() -> None:
    chunks = chunk_text(_sentences(600), _count_words)
    first_words = set(chunks[0].split())
    second_words = chunks[1].split()
    assert any(word in first_words for word in second_words)


def test_giant_single_sentence_is_word_split() -> None:
    giant = " ".join(f"w{i}" for i in range(HARD_MAX_TOKENS * 2))  # one period-free sentence
    chunks = chunk_text(giant, _count_words)
    assert len(chunks) >= 2
    assert all(_count_words(chunk) <= HARD_MAX_TOKENS for chunk in chunks)


def test_normal_packing_stops_at_target_not_hard_max() -> None:
    """With ordinary short sentences, packing should stop at TARGET_TOKENS rather than growing all
    the way to HARD_MAX_TOKENS just because that's technically still within the cap."""
    chunks = chunk_text(_sentences(600), _count_words)
    non_final_chunks = chunks[:-1]
    assert len(non_final_chunks) >= 2  # otherwise this test isn't exercising the packing loop
    for chunk in non_final_chunks:
        token_count = _count_words(chunk)
        assert token_count <= TARGET_TOKENS
        assert token_count > TARGET_TOKENS - 10  # within one sentence (10 tokens) of the target


def test_sentence_between_target_and_hard_max_forms_its_own_chunk() -> None:
    """A single sentence longer than TARGET_TOKENS but within HARD_MAX_TOKENS is kept whole (not
    word-split) and is the one legitimate way a chunk grows past the target."""
    lead_in = _sentences(TARGET_TOKENS)
    long_sentence = " ".join(f"w{i}" for i in range(TARGET_TOKENS + 20)) + "."
    chunks = chunk_text(f"{lead_in} {long_sentence}", _count_words)
    assert any(_count_words(chunk) > TARGET_TOKENS for chunk in chunks)
    assert all(_count_words(chunk) <= HARD_MAX_TOKENS for chunk in chunks)
