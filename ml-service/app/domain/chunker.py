"""
Purpose:   Token-aware chunking tuned for retrieval precision (§2.2 / ADR-008): smaller, focused
           chunks retrieve more precisely than large ones, so sentences are greedily packed toward
           TARGET_TOKENS and only allowed to spill up to HARD_MAX_TOKENS when a single sentence is
           itself long. Docs at or under SINGLE_CHUNK_THRESHOLD are stored whole (no split).
Layer:     domain
May import:   stdlib (the tokenizer is injected as a callable to keep this pure and unit-testable)
Must NOT import:  api/*, services/*, components/*; transformers, asyncpg, FastAPI
"""
from __future__ import annotations

import re
from collections.abc import Callable

TARGET_TOKENS = 300
HARD_MAX_TOKENS = 400
OVERLAP_TOKENS = 50
SINGLE_CHUNK_THRESHOLD = 350  # docs <= this many tokens are stored whole (no split)

# Split a paragraph into sentences at whitespace that follows a period, keeping the period attached.
_SENTENCE_SPLIT_RE = re.compile(r"(?<=\.)\s+")


def chunk_text(text: str, count_tokens_fn: Callable[[str], int]) -> list[str]:
    """
    Split text into chunks measured in tokens (never characters/words).

    Small docs (<= SINGLE_CHUNK_THRESHOLD tokens) return as a single chunk. Otherwise sentences are
    greedily packed until the next would push the chunk past TARGET_TOKENS — that's the normal
    stopping point, not HARD_MAX_TOKENS; each new chunk is seeded with the trailing ~OVERLAP_TOKENS
    of the previous one for continuity. A chunk only grows past TARGET_TOKENS (up to
    HARD_MAX_TOKENS) when a single sentence pushes it there; a lone sentence over the hard cap is
    word-split as a last resort instead. Every returned string is stripped, non-empty, and within
    the cap (except the rare token-less giant word). Always returns at least one element.
    """
    text = text.strip()
    if not text:
        return [text]
    if count_tokens_fn(text) <= SINGLE_CHUNK_THRESHOLD:
        return [text]

    sentences = _split_sentences(text)
    chunks: list[str] = []
    current: list[str] = []
    current_tokens = 0

    for sentence in sentences:
        sentence_tokens = count_tokens_fn(sentence)

        # A single sentence larger than the cap can never fit — flush, then hard-split it by words.
        if sentence_tokens > HARD_MAX_TOKENS:
            if current:
                chunks.append(" ".join(current))
                current, current_tokens = [], 0
            chunks.extend(_split_long_sentence(sentence, count_tokens_fn))
            continue

        if current and current_tokens + sentence_tokens > TARGET_TOKENS:
            chunks.append(" ".join(current))
            overlap = _overlap_tail(current, count_tokens_fn)
            overlap_tokens = count_tokens_fn(" ".join(overlap)) if overlap else 0
            # Drop the overlap if it would leave no room for this sentence (guarantees progress).
            if overlap_tokens + sentence_tokens > HARD_MAX_TOKENS:
                overlap, overlap_tokens = [], 0
            current, current_tokens = list(overlap), overlap_tokens

        current.append(sentence)
        current_tokens += sentence_tokens

    if current:
        chunks.append(" ".join(current))

    result = [chunk for chunk in (c.strip() for c in chunks) if chunk]
    return result or [text]


def _split_sentences(text: str) -> list[str]:
    """Paragraphs (\\n\\n) then sentences (period + whitespace); every piece stripped and
    non-empty."""
    sentences: list[str] = []
    for paragraph in text.split("\n\n"):
        paragraph = paragraph.strip()
        if not paragraph:
            continue
        for sentence in _SENTENCE_SPLIT_RE.split(paragraph):
            sentence = sentence.strip()
            if sentence:
                sentences.append(sentence)
    return sentences


def _overlap_tail(sentences: list[str], count_tokens_fn: Callable[[str], int]) -> list[str]:
    """Trailing sentences whose cumulative token count stays around
    OVERLAP_TOKENS (at least one)."""
    tail: list[str] = []
    total = 0
    for sentence in reversed(sentences):
        if tail and total + count_tokens_fn(sentence) > OVERLAP_TOKENS:
            break
        tail.insert(0, sentence)
        total += count_tokens_fn(sentence)
        if total >= OVERLAP_TOKENS:
            break
    return tail


def _split_long_sentence(sentence: str, count_tokens_fn: Callable[[str], int]) -> list[str]:
    """Last resort: greedily pack words up to HARD_MAX_TOKENS (rare; dense tables/lists)."""
    chunks: list[str] = []
    current: list[str] = []
    current_tokens = 0
    for word in sentence.split():
        word_tokens = count_tokens_fn(word)
        if current and current_tokens + word_tokens > HARD_MAX_TOKENS:
            chunks.append(" ".join(current))
            current, current_tokens = [], 0
        current.append(word)
        current_tokens += word_tokens
    if current:
        chunks.append(" ".join(current))
    return chunks
