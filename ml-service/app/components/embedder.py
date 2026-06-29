"""
Purpose:   e5-base load + encode with required prefixes ('query: ' / 'passage: '), CPU-bound
           encode offloaded via loop.run_in_executor onto a dedicated ThreadPoolExecutor(2),
           gated by Semaphore(2) so concurrent requests can't starve the event loop. Instance-level
           LRU(1000) cache for query embeddings; tokenizer-based count_tokens for the chunker.
           Model loaded ONCE in the lifespan — never per request.
Layer:     component
May import:   stdlib, numpy, sentence-transformers, torch
Must NOT import:  app/* (except config types), services/*, api/*, other components/*; FastAPI, asyncpg
"""
from __future__ import annotations

import asyncio
import hashlib
import logging
import re
import time
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor

import numpy as np
import torch
from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)

# Dedicated executor + semaphore: cap concurrent CPU encode work at 2 (design decision 3).
_THREAD_POOL = ThreadPoolExecutor(max_workers=2, thread_name_prefix="embedder")
_ENCODE_SEMAPHORE = asyncio.Semaphore(2)

# e5 REQUIRES these prefixes; swapping them silently destroys recall (asserted in tests).
_QUERY_PREFIX = "query: "
_PASSAGE_PREFIX = "passage: "
_WHITESPACE_RE = re.compile(r"\s+")


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


class Embedder:
    def __init__(self, model_name: str, num_threads: int = 4, cache_maxsize: int = 1000) -> None:
        # Effective thread cap. NOTE: torch does NOT read a TORCH_NUM_THREADS env var;
        # set_num_threads is the real lever to stop torch grabbing every core (design decision 7).
        torch.set_num_threads(num_threads)
        self.model = SentenceTransformer(model_name)
        self._tokenizer = self.model.tokenizer
        self._query_cache = LRUCache(maxsize=cache_maxsize)

    def _normalize_for_cache(self, text: str) -> str:
        return _WHITESPACE_RE.sub(" ", text.lower().strip())

    def _cache_key(self, text: str) -> str:
        return hashlib.sha1(self._normalize_for_cache(text).encode("utf-8")).hexdigest()

    def _encode_sync(self, texts: list[str]) -> np.ndarray:
        """Pure sync — always called via run_in_executor, never directly on the event loop."""
        return self.model.encode(
            texts,
            batch_size=32,
            normalize_embeddings=True,
            show_progress_bar=False,
        )

    async def _encode(self, texts: list[str]) -> np.ndarray:
        loop = asyncio.get_running_loop()
        start = time.perf_counter()
        async with _ENCODE_SEMAPHORE:
            vecs = await loop.run_in_executor(_THREAD_POOL, self._encode_sync, texts)
        logger.debug("encode n=%d took %.1fms", len(texts), (time.perf_counter() - start) * 1000)
        return vecs

    async def encode_query(self, text: str) -> np.ndarray:
        """Prefix 'query: ' (required by e5). Instance LRU cache hit avoids the encode entirely."""
        key = self._cache_key(text)
        cached = self._query_cache.get(key)
        if cached is not None:
            return cached
        prefixed = f"{_QUERY_PREFIX}{self._normalize_for_cache(text)}"
        result = (await self._encode([prefixed]))[0]
        self._query_cache.put(key, result)
        return result

    async def encode_passages(self, texts: list[str]) -> np.ndarray:
        """Prefix 'passage: ' (required by e5). No caching — one-shot at ingest. Returns (n, 768)."""
        prefixed = [f"{_PASSAGE_PREFIX}{t}" for t in texts]
        return await self._encode(prefixed)

    def count_tokens(self, text: str) -> int:
        """Token count via the model's own subword tokenizer (chunker 480-token cap, §2.2)."""
        return len(self._tokenizer.encode(text, add_special_tokens=True))
