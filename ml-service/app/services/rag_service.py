"""
Purpose:   RAG query orchestration (§3.2, §4.2): rate-limit -> canonicalize district -> classify ->
           answer-cache -> embed -> hybrid retrieve (dense+lexical, concurrent) -> RRF fuse ->
           confidence gate (dense top-1) -> generate (Gemini, timeout+retry) -> extractive fallback
           on any LLM error. Only the SIMPLE path is implemented; COMPLEX falls back to SIMPLE until
           the agent pipeline lands (AGENT_RAG_ENABLED). Pure orchestration over injected deps.
Layer:     service
May import:   domain/* (fusion, classifier, districts, prompts), schemas/query, components/repository
              + embedder, config, errors, google-genai
Must NOT import:  other services/*, api/*, FastAPI/Starlette, asyncpg directly
"""
from __future__ import annotations

import asyncio
import hashlib
import logging
import random
import time
from collections import OrderedDict

from google import genai
from google.genai import types
from google.genai.errors import APIError

from app.components.embedder import Embedder
from app.components.repository import KnowledgeRepository
from app.config import Settings
from app.domain.classifier import QueryRoute, classify_query
from app.domain.districts import canonicalize_district
from app.domain.fusion import reciprocal_rank_fusion
from app.domain.prompts import build_rag_prompt
from app.errors import RateLimitedError
from app.schemas.query import QueryRequest, QueryResponse, SourceUsed

logger = logging.getLogger(__name__)

_NO_INFO_ANSWER = "Поки що немає інформації за цим запитом."
_FALLBACK_PREFIX = "За наявними даними: "

_RETRIEVE_LIMIT = 10
_CONTEXT_CHUNKS = 3
_GENERATE_TIMEOUT_S = 8.0
_GENERATION_TEMPERATURE = 0.3
_MAX_OUTPUT_TOKENS = 1024
_RETRYABLE_STATUS = frozenset({429, 500, 502, 503, 504})
_RETRY_BACKOFF_S = (0.5, 1.0)  # one delay per retry; len == number of retries
_FALLBACK_CONFIDENCE_CAP = 0.5


class _AnswerCache:
    """TTL + LRU cache over QueryResponse, keyed by normalized query + district slug. Avoids redundant
    Gemini calls for repeated questions. Single-process asyncio use only — not thread-safe."""

    def __init__(self, maxsize: int, ttl_seconds: int) -> None:
        self._maxsize = maxsize
        self._ttl = ttl_seconds
        self._store: OrderedDict[str, tuple[QueryResponse, float]] = OrderedDict()

    def get(self, query: str, district: str | None) -> QueryResponse | None:
        key = self._make_key(query, district)
        entry = self._store.get(key)
        if entry is None:
            return None
        response, inserted_at = entry
        if time.monotonic() - inserted_at > self._ttl:
            del self._store[key]
            return None
        self._store.move_to_end(key)
        return response

    def put(self, query: str, district: str | None, response: QueryResponse) -> None:
        key = self._make_key(query, district)
        self._store[key] = (response, time.monotonic())
        self._store.move_to_end(key)
        if len(self._store) > self._maxsize:
            self._store.popitem(last=False)

    @staticmethod
    def _make_key(query: str, district: str | None) -> str:
        raw = f"{query.lower().strip()}|{district or ''}"
        return hashlib.sha1(raw.encode("utf-8")).hexdigest()


class RagService:
    def __init__(
        self,
        repo: KnowledgeRepository,
        embedder: Embedder,
        gemini: genai.Client,
        settings: Settings,
    ) -> None:
        self._repo = repo
        self._embedder = embedder
        self._gemini = gemini
        self._settings = settings
        self._cache = _AnswerCache(
            maxsize=settings.answer_cache_maxsize,
            ttl_seconds=settings.answer_cache_ttl_seconds,
        )

    async def query(self, request: QueryRequest) -> QueryResponse:
        """Full SIMPLE RAG pipeline (§4.2). LLM failures degrade to extractive fallback, never 5xx."""
        start = time.perf_counter()
        user_hash = self._hash_user(request.user_id)

        # 1. Per-user rate limit (Postgres fixed-window). Exceeded -> 429 via the error handler.
        allowed = await self._repo.check_and_increment_rate_limit(
            request.user_id, self._settings.rate_limit_per_minute
        )
        if not allowed:
            raise RateLimitedError("Зачекайте трохи — перевищено ліміт запитів.")

        # 2. Canonicalize district (unknown -> city-wide + warn, §2.6).
        district_slug = canonicalize_district(request.district)
        if request.district is not None and district_slug is None:
            logger.warning("query_unknown_district raw=%r", request.district)

        # 3. Route. COMPLEX falls back to SIMPLE until the agent pipeline is enabled.
        route = classify_query(request.user_query)
        if route is QueryRoute.COMPLEX and not self._settings.agent_rag_enabled:
            logger.info("query_complex_fallback_to_simple user=%s", user_hash)

        # 4. Answer cache (route re-stamped on the cached copy for observability).
        cached = self._cache.get(request.user_query, district_slug)
        if cached is not None:
            logger.info("query_cache_hit user=%s route=%s", user_hash, route.value)
            return cached.model_copy(update={"route": route})

        # 5. Embed the query (e5 'query:' prefix handled inside the embedder).
        query_vec = await self._embedder.encode_query(request.user_query)

        # 6. Hybrid retrieval — both legs concurrently — then RRF fuse.
        dense, lexical = await asyncio.gather(
            self._repo.retrieve_dense(query_vec, district_slug, limit=_RETRIEVE_LIMIT),
            self._repo.retrieve_lexical(request.user_query, district_slug, limit=_RETRIEVE_LIMIT),
        )
        fused = reciprocal_rank_fusion(dense, lexical, k=self._settings.rrf_k)

        # 7. Confidence gate on the DENSE top-1 cosine (never the RRF score). Empty/low -> no-info,
        #    and the LLM is NOT called.
        top1_sim = dense[0].similarity if dense else 0.0
        if not fused or top1_sim < self._settings.sim_gate:
            logger.info(
                "query_no_info user=%s district=%s route=%s top1=%.3f took=%.1fms",
                user_hash, district_slug, route.value, top1_sim, self._elapsed_ms(start),
            )
            return QueryResponse(
                answer=_NO_INFO_ANSWER, sources_used=[], confidence=0.0, route=route
            )

        top_results = fused[:_CONTEXT_CHUNKS]
        context_chunks = [result.text for result in top_results]

        # 8. Generate, or degrade to extractive fallback on ANY LLM error (never 5xx the caller).
        gemini_ok = True
        try:
            answer = await self._generate(context_chunks, request.user_query)
            confidence = round(top1_sim, 2)
        except Exception as exc:  # noqa: BLE001 — LLM is the least reliable hop; demo must stay alive (ADR-007)
            gemini_ok = False
            answer = _FALLBACK_PREFIX + top_results[0].text
            confidence = min(round(top1_sim, 2), _FALLBACK_CONFIDENCE_CAP)
            logger.warning("query_gemini_fallback user=%s err=%s", user_hash, type(exc).__name__)

        # 9. Sources from the same chunks shown to the model.
        sources = [
            SourceUsed(
                source=result.source,
                doc_type=result.doc_type,
                district=result.district,
                similarity=round(result.similarity, 4),
            )
            for result in top_results
        ]

        # 10. Assemble, cache, log (user_id hashed; raw query only at DEBUG).
        response = QueryResponse(
            answer=answer, sources_used=sources, confidence=confidence, route=route
        )
        self._cache.put(request.user_query, district_slug, response)
        logger.info(
            "query_ok user=%s district=%s route=%s top1=%.3f n_chunks=%d gemini_ok=%s took=%.1fms",
            user_hash, district_slug, route.value, top1_sim, len(context_chunks), gemini_ok,
            self._elapsed_ms(start),
        )
        logger.debug("query_text user=%s text=%r", user_hash, request.user_query)
        return response

    async def _generate(self, context_chunks: list[str], question: str) -> str:
        """Call Gemini async with an 8s per-attempt timeout and up to 2 retries on transient status."""
        prompt = build_rag_prompt(context_chunks, question)
        config = types.GenerateContentConfig(
            temperature=_GENERATION_TEMPERATURE,
            max_output_tokens=_MAX_OUTPUT_TOKENS,
        )
        last_attempt = len(_RETRY_BACKOFF_S)  # initial attempt index 0 + len(...) retries
        for attempt in range(last_attempt + 1):
            try:
                response = await asyncio.wait_for(
                    self._gemini.aio.models.generate_content(
                        model=self._settings.gemini_model,
                        contents=prompt,
                        config=config,
                    ),
                    timeout=_GENERATE_TIMEOUT_S,
                )
                return response.text
            except APIError as exc:
                if exc.code not in _RETRYABLE_STATUS or attempt == last_attempt:
                    raise  # non-transient 4xx, or retries exhausted
                await self._sleep_backoff(attempt, f"status={exc.code}")
            except (asyncio.TimeoutError, ConnectionError):
                if attempt == last_attempt:
                    raise
                await self._sleep_backoff(attempt, "timeout")
        raise RuntimeError("unreachable: retry loop exhausted without return or raise")

    @staticmethod
    async def _sleep_backoff(attempt: int, reason: str) -> None:
        """Jittered exponential backoff between retries (±20% jitter)."""
        delay = _RETRY_BACKOFF_S[attempt] * random.uniform(0.8, 1.2)
        logger.warning("gemini_retry attempt=%d reason=%s delay=%.2fs", attempt + 1, reason, delay)
        await asyncio.sleep(delay)

    @staticmethod
    def _hash_user(user_id: str) -> str:
        """Hash the Telegram id for logs — the raw id is never logged or stored."""
        return hashlib.sha256(user_id.encode("utf-8")).hexdigest()[:8]

    @staticmethod
    def _elapsed_ms(start: float) -> float:
        return (time.perf_counter() - start) * 1000
