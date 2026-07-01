"""
Purpose:   Deterministic fake implementing protocols.Embedder for eval/tests/test_eval_gate.py
           ONLY. FakeEmbedder's all-zero vector is undefined under pgvector's cosine (<=>) operator
           (division by zero), so it cannot be used against real dense retrieval. This fake returns
           well-behaved, non-zero, unit-length vectors instead: text containing one of a small set
           of topic anchors shared verbatim between eval/datasets/retrieval_gold.jsonl queries and
           eval/datasets/retrieval_fixtures.jsonl documents gets a vector seeded from that anchor,
           so a gold query and its correct fixture land at cosine similarity 1.0; any other text
           gets a vector seeded from its own hash instead, which is effectively orthogonal to every
           anchor (mirrors tests/integration/conftest.py's make_random_vec/make_target_vec, but
           keyed by topic rather than by an explicit seed vector passed in by the caller).
Layer:     test
May import:   stdlib (hashlib), numpy, app.protocols (Embedder interface)
Must NOT import:  openai, tiktoken (the whole point is to avoid the real embedder in CI)
"""
from __future__ import annotations

import hashlib

import numpy as np

from app.protocols import Embedder

_EMBED_DIM = 1536

# Anchors shared verbatim (case-insensitive) between the two eval datasets — see both files. Each
# gold query and its matching fixture document contain exactly one of these, and the five are
# mutually exclusive substrings, so keyword matching alone is enough to pair them up correctly.
_TOPIC_ANCHORS: tuple[str, ...] = (
    "богунськ",
    "лічильник",
    "київській",
    "субсиді",
    "яму на дорозі",
)


def _seed_from_text(text: str) -> int:
    digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
    return int(digest[:8], 16)


def _unit_vector(seed: int) -> np.ndarray:
    rng = np.random.RandomState(seed)
    vec = rng.randn(_EMBED_DIM).astype(np.float32)
    return vec / np.linalg.norm(vec)


def _topic_key(text: str) -> str:
    """The matched anchor, or the raw text itself when no anchor matches — an unrelated query and
    an unrelated document both fall back to their own (mutually unrelated) hash."""
    lowered = text.lower()
    for anchor in _TOPIC_ANCHORS:
        if anchor in lowered:
            return anchor
    return text


class DeterministicFakeEmbedder(Embedder):
    """Records every call it's asked to encode, like FakeEmbedder. Vectors are non-zero, unit
    length, and reproducible across runs — safe to feed to real pgvector cosine distance."""

    def __init__(self) -> None:
        self.encoded_queries: list[str] = []
        self.encoded_passages: list[list[str]] = []

    async def encode_query(self, text: str) -> np.ndarray:
        self.encoded_queries.append(text)
        return _unit_vector(_seed_from_text(_topic_key(text)))

    async def encode_passages(self, texts: list[str]) -> np.ndarray:
        self.encoded_passages.append(texts)
        return np.stack([_unit_vector(_seed_from_text(_topic_key(t))) for t in texts])

    def count_tokens(self, text: str) -> int:
        return len(text.split())
