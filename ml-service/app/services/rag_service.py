"""
Purpose:   RAG query router (§3.2, §4.2): rate-limit -> canonicalize district -> classify -> answer-
           cache -> select SimpleRAGPipeline or AgentRAGPipeline (SIMPLE always; COMPLEX only reaches
           the agent when AGENT_RAG_ENABLED, otherwise falls back to simple) -> map the pipeline's
           RagResult onto the QueryResponse HTTP contract. All retrieval/generation/fallback logic
           now lives in pipeline/* — HybridRetriever owns dense+lexical+RRF, and
           pipeline.base.run_shared_tail owns the confidence gate -> generate -> extractive-fallback
           tail shared by both pipelines — so this module is pure orchestration over the pipelines,
           not over components directly.
Layer:     service
May import:   domain/{classifier, districts}, schemas/query, app.protocols (Generator port, for the
              constructor signature only), components/repository + embedder + hybrid_retriever +
              rate_limiter, pipeline/{base, simple, agent}, config, errors, metrics
Must NOT import:  other services/*, api/*, FastAPI/Starlette, asyncpg directly, openai directly (LLM
              failure classification now lives in pipeline.base._fallback_reason)
"""
from __future__ import annotations

import hashlib
import logging
import time
from collections import OrderedDict

from app.components.embedder import Embedder
from app.components.hybrid_retriever import HybridRetriever
from app.components.rate_limiter import current_window, evaluate, hash_user_id
from app.components.repository import KnowledgeRepository
from app.config import Settings
from app.domain.classifier import QueryRoute, classify_query
from app.domain.districts import canonicalize_district
from app.errors import RateLimitedError
from app.metrics import district_unmapped, query_route_total
from app.pipeline.agent import AgentRAGPipeline
from app.pipeline.base import RAGPipeline, RagContext
from app.pipeline.simple import SimpleRAGPipeline
from app.protocols import Generator
from app.schemas.query import QueryRequest, QueryResponse

logger = logging.getLogger(__name__)


class _AnswerCache:
    """TTL + LRU cache over QueryResponse, keyed by normalized query + district slug. Avoids redundant
    LLM calls for repeated questions. Single-process asyncio use only — not thread-safe."""

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
        generator: Generator,
        settings: Settings,
    ) -> None:
        self._repo = repo
        self._settings = settings
        self._cache = _AnswerCache(
            maxsize=settings.answer_cache_maxsize,
            ttl_seconds=settings.answer_cache_ttl_seconds,
        )
        retriever = HybridRetriever(repo, settings.rrf_k)
        self._simple = SimpleRAGPipeline(
            embedder, retriever, generator, settings.sim_gate, settings.sim_high
        )
        self._agent = AgentRAGPipeline(
            embedder, retriever, generator, settings.sim_gate, settings.sim_high,
            settings.agent_max_subqueries,
        )

    async def query(self, request: QueryRequest) -> QueryResponse:
        """Route to SimpleRAGPipeline or AgentRAGPipeline (§4.2). LLM failures degrade to extractive
        fallback inside the pipeline's shared tail, never 5xx."""
        start = time.perf_counter()
        user_hash = self._hash_user(request.user_id)

        # 1. Per-user rate limit (Postgres fixed-window, hashed key). Exceeded -> 429 via the
        #    error handler. The repository only persists the count; rate_limiter.evaluate owns
        #    the allow/deny policy.
        hashed_key = hash_user_id(request.user_id)
        count = await self._repo.incr_rate_limit_counter(hashed_key, current_window())
        decision = evaluate(count, self._settings.rate_limit_per_minute)
        if not decision.allowed:
            raise RateLimitedError("Зачекайте трохи — перевищено ліміт запитів.")

        # 2. Canonicalize district (unknown -> city-wide + warn, §2.6).
        district_slug = canonicalize_district(request.district)
        if request.district is not None and district_slug is None:
            logger.warning("query_unknown_district raw=%r", request.district)
            district_unmapped.labels(boundary="query").inc()

        # 3. Route. COMPLEX only reaches the agent pipeline when the feature flag is on; the response
        #    still carries the classifier's real decision either way (observability, §4.2).
        route = classify_query(request.user_query)
        query_route_total.labels(route=route.value).inc()
        if route is QueryRoute.COMPLEX and self._settings.agent_rag_enabled:
            pipeline: RAGPipeline = self._agent
        else:
            if route is QueryRoute.COMPLEX:
                logger.info("query_complex_fallback_to_simple user=%s", user_hash)
            pipeline = self._simple

        # 4. Answer cache (route re-stamped on the cached copy for observability).
        cached = self._cache.get(request.user_query, district_slug)
        if cached is not None:
            logger.info("query_cache_hit user=%s route=%s", user_hash, route.value)
            return cached.model_copy(update={"route": route})

        # 5. Run the selected pipeline — embedding, retrieval, and the shared confidence-gate ->
        #    generate -> extractive-fallback tail all live behind this call.
        ctx = RagContext(user_query=request.user_query, district_slug=district_slug, route=route)
        result = await pipeline.run(ctx)

        # 6. Map to the HTTP contract, log (user_id hashed; raw query only at DEBUG).
        response = QueryResponse(
            answer=result.answer,
            sources_used=result.sources_used,
            confidence=result.confidence,
            route=result.route,
        )
        if result.debug.get("no_info"):
            # No-info answers are never cached — cheap to recompute (no LLM call was made), and
            # caching one for the TTL window would risk serving a stale "no info" after the KB
            # picks up new content that would have answered this same query.
            logger.info(
                "query_no_info user=%s district=%s route=%s top1=%.3f took=%.1fms",
                user_hash, district_slug, route.value, result.debug.get("top1_sim", 0.0),
                self._elapsed_ms(start),
            )
        else:
            self._cache.put(request.user_query, district_slug, response)
            logger.info(
                "query_ok user=%s district=%s route=%s top1=%.3f n_chunks=%d llm_ok=%s "
                "llm_retries=%d took=%.1fms",
                user_hash, district_slug, route.value, result.debug.get("top1_sim", 0.0),
                result.debug.get("n_chunks", 0), result.debug.get("llm_ok"),
                result.debug.get("llm_retries", 0), self._elapsed_ms(start),
            )
        logger.debug("query_text user=%s text=%r", user_hash, request.user_query)
        return response

    @staticmethod
    def _hash_user(user_id: str) -> str:
        """Grep-friendly 8-char log prefix, sharing rate_limiter.hash_user_id's digest rather than
        a second independent hash — the raw id is never logged or stored."""
        return hash_user_id(user_id)[:8]

    @staticmethod
    def _elapsed_ms(start: float) -> float:
        return (time.perf_counter() - start) * 1000
