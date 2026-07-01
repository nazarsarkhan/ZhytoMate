"""
Purpose:   Deterministic fake implementing protocols.Embedder: always returns a zero vector of the
           real embedding dimension (no similarity math ever runs against fake vectors in unit
           tests — FakeRetriever returns pre-scripted RetrievalOutcomes rather than computing cosine
           distances), and a word-count stand-in for token counting. Fast, no model load or network
           call in CI.
Layer:     test
May import:   stdlib, numpy, app.protocols (Embedder interface)
Must NOT import:  openai, tiktoken (the whole point is to avoid the real embedder in CI)
"""
from __future__ import annotations

import numpy as np

from app.protocols import Embedder

_EMBED_DIM = 1536


class FakeEmbedder(Embedder):
    """Records every text it's asked to encode; always returns a zero vector. count_tokens is a
    plain word count, matching the `_count_words` style already used in domain unit tests."""

    def __init__(self) -> None:
        self.encoded_queries: list[str] = []
        self.encoded_passages: list[list[str]] = []

    async def encode_query(self, text: str) -> np.ndarray:
        self.encoded_queries.append(text)
        return np.zeros(_EMBED_DIM, dtype=np.float32)

    async def encode_passages(self, texts: list[str]) -> np.ndarray:
        self.encoded_passages.append(texts)
        return np.zeros((len(texts), _EMBED_DIM), dtype=np.float32)

    def count_tokens(self, text: str) -> int:
        return len(text.split())
