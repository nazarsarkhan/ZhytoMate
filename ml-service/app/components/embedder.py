"""
Purpose:   OpenAI embedding wrapper (model injected via config; 1536d). Async HTTP calls replace
           the old local CPU encode — no threadpool/semaphore needed (network-bound, not
           CPU-bound). OpenAI vectors are NOT unit-length, so we L2-normalize each row to match
           the DB's cosine (<=>) convention (same as the old e5 setup). Same public interface
           (encode_query / encode_passages / count_tokens) as the old e5 Embedder, so callers
           don't change.
Layer:     component
May import:   stdlib, numpy, openai, tiktoken, app.protocols
Must NOT import:  app/* (except config types), services/*, api/*, other components/*; FastAPI, asyncpg
"""
from __future__ import annotations

import asyncio
import hashlib
import logging
import random
import re
from collections import OrderedDict

import numpy as np
import tiktoken
from openai import APIConnectionError, APIStatusError, APITimeoutError, AsyncOpenAI

from app.protocols import Embedder as EmbedderPort

logger = logging.getLogger(__name__)

_EMBED_DIM = 1536
_WHITESPACE_RE = re.compile(r"\s+")

_RETRYABLE_STATUS = frozenset({429, 500, 502, 503, 504})
_RETRY_BACKOFF_S = (0.5, 1.0)  # one delay per retry; len == number of retries


class LRUCache:
    """Simple LRU over OrderedDict for query-embedding caching (single-threaded asyncio use)."""

    def __init__(self, maxsize: int) -> None:
        self._maxsize = maxsize
        self._store: OrderedDict[str, np.ndarray] = OrderedDict()

    def get(self, key: str) -> np.ndarray | None:
        value = self._store.get(key)
        if value is None:
            return None
        self._store.move_to_end(key)
        return value

    def put(self, key: str, value: np.ndarray) -> None:
        self._store[key] = value
        self._store.move_to_end(key)
        if len(self._store) > self._maxsize:
            self._store.popitem(last=False)


def _l2_normalize(vectors: np.ndarray) -> np.ndarray:
    """Row-wise L2 normalization. OpenAI embeddings are not unit-length; the DB cosine (<=>)
    operator and the old e5 convention both assume normalized vectors."""
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    norms[norms == 0] = 1.0  # guard against a zero vector
    return (vectors / norms).astype(np.float32)


class Embedder(EmbedderPort):
    """OpenAI-backed embedder. No query:/passage: prefixes (unlike e5) — the configured model is
    single-purpose. No local model load; the async client is lightweight, created once."""

    def __init__(self, api_key: str, model: str, cache_maxsize: int = 1000) -> None:
        self._client = AsyncOpenAI(api_key=api_key)
        self._model = model
        self._query_cache = LRUCache(maxsize=cache_maxsize)
        # cl100k_base covers text-embedding-3-* token counting for the chunker's cap.
        self._tokenizer = tiktoken.get_encoding("cl100k_base")

    def _normalize_for_cache(self, text: str) -> str:
        return _WHITESPACE_RE.sub(" ", text.lower().strip())

    def _cache_key(self, text: str) -> str:
        return hashlib.sha1(self._normalize_for_cache(text).encode("utf-8")).hexdigest()

    async def _embed_api_call(self, texts: list[str]) -> np.ndarray:
        """One batched embeddings call (1536d), L2-normalized. Up to 2 retries on a retryable status
        (429/5xx) or a connection/timeout error; raises on persistent failure (ingest fails loudly;
        the query path catches it and degrades — see rag_service)."""
        last_attempt = len(_RETRY_BACKOFF_S)
        for attempt in range(last_attempt + 1):
            try:
                response = await self._client.embeddings.create(
                    model=self._model, input=texts, dimensions=_EMBED_DIM
                )
                vectors = np.array([item.embedding for item in response.data], dtype=np.float32)
                return _l2_normalize(vectors)
            except (APITimeoutError, APIConnectionError):
                if attempt == last_attempt:
                    raise
                await self._sleep_backoff(attempt, "connection")
            except APIStatusError as exc:
                if exc.status_code not in _RETRYABLE_STATUS or attempt == last_attempt:
                    raise
                await self._sleep_backoff(attempt, f"status={exc.status_code}")
        raise RuntimeError("unreachable: retry loop exhausted without return or raise")

    @staticmethod
    async def _sleep_backoff(attempt: int, reason: str) -> None:
        """Jittered backoff between retries (±20% jitter)."""
        delay = _RETRY_BACKOFF_S[attempt] * random.uniform(0.8, 1.2)
        logger.warning("embed_retry attempt=%d reason=%s delay=%.2fs", attempt + 1, reason, delay)
        await asyncio.sleep(delay)

    async def encode_query(self, text: str) -> np.ndarray:
        """LRU-cached. No 'query: ' prefix (OpenAI, unlike e5). Cache miss -> single-text batch call."""
        key = self._cache_key(text)
        cached = self._query_cache.get(key)
        if cached is not None:
            return cached
        normalized = self._normalize_for_cache(text)
        result = (await self._embed_api_call([normalized]))[0]
        self._query_cache.put(key, result)
        return result

    async def encode_passages(self, texts: list[str]) -> np.ndarray:
        """One batched call at ingest — no caching, no prefix. Returns shape (len(texts), 1536)."""
        return await self._embed_api_call(texts)

    def count_tokens(self, text: str) -> int:
        """tiktoken cl100k_base count — used by the chunker's token cap (§2.2)."""
        return len(self._tokenizer.encode(text))
