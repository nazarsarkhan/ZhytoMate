"""
Purpose:   Swap ports (ABCs) for the expensive/external resources: Embedder, Retriever, Generator,
           VisionGenerator. Services/pipelines depend on these, not concretes — lets pgvector and
           the hosted LLM be swapped without touching orchestration. Retriever.retrieve(query_text,
           query_vec, district, k) takes BOTH text (lexical leg) and vector (dense leg) for hybrid
           search, scoped to a single canonical district slug (or None for city-wide) — the system
           never filters on anything else, so the port stays concrete rather than a generic filter
           dict.
Layer:     protocols  (leaf, like config — imported widely, imports nothing internal but
           schemas/domain types)
May import:   stdlib (abc, typing), numpy, domain/* types, schemas/common, app.schemas.retrieval
Must NOT import:  api/*, services/*, components/*, pipeline/*; any I/O or model lib (asyncpg,
              openai, FastAPI)
"""
from __future__ import annotations

from abc import ABC, abstractmethod

import numpy as np

from app.schemas.retrieval import RetrievalOutcome


class Embedder(ABC):
    """Text -> vector, plus a token counter for the chunker's cap. Implementations own their own
    caching/prefixing/batching concerns; callers only see this shape."""

    @abstractmethod
    async def encode_query(self, text: str) -> np.ndarray: ...

    @abstractmethod
    async def encode_passages(self, texts: list[str]) -> np.ndarray: ...

    @abstractmethod
    def count_tokens(self, text: str) -> int: ...


class Generator(ABC):
    """Single-shot text generation (RAG answer synthesis, agent decompose/synthesis)."""

    @abstractmethod
    async def generate(
        self,
        prompt: str,
        *,
        temperature: float,
        max_tokens: int,
        timeout_s: float,
        json_mode: bool = False,
    ) -> tuple[str, int]:
        """Returns (answer_text, retry_count). retry_count feeds the structured-log llm_retries
        field. json_mode=True enforces valid-JSON output at the API level (OpenAI's
        response_format={"type": "json_object"}) for callers that parse the reply as JSON
        themselves (e.g. pipeline.base's safety check / detect_and_translate) — the prompt text
        alone is not a reliable enough contract for those callers, see components.llm."""
        ...


class VisionGenerator(ABC):
    """Image + prompt -> raw model text (expected to be JSON; validation is the caller's job)."""

    @abstractmethod
    async def analyze_image(
        self,
        image_bytes: bytes,
        mime_type: str,
        prompt: str,
        *,
        temperature: float,
        max_tokens: int,
        timeout_s: float,
    ) -> tuple[str, int]:
        """Returns (raw_text, retry_count)."""
        ...


class Retriever(ABC):
    """Hybrid retrieval: dense (pgvector) + lexical (tsvector) legs, fused by the caller's RRF pass
    or by the implementation itself — see RetrievalOutcome for what's returned either way."""

    @abstractmethod
    async def retrieve(
        self, query_text: str, query_vec: np.ndarray, district: str | None, k: int
    ) -> RetrievalOutcome: ...
