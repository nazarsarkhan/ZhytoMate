"""
Purpose:   RAG query router (§3.2, §4.2): rate-limit -> canonicalize district -> classify
           -> answer-cache -> select SimpleRAGPipeline or AgentRAGPipeline (SIMPLE always; COMPLEX
           only reaches the agent when AGENT_RAG_ENABLED, otherwise falls back to simple) -> map the
           pipeline's RagResult onto the QueryResponse HTTP contract. All
           retrieval/generation/fallback logic now lives in pipeline/* — HybridRetriever owns
           dense+lexical+RRF, and pipeline.base.run_shared_tail owns the confidence gate -> generate
           -> extractive-fallback tail shared by both pipelines — so this module is pure
           orchestration over the pipelines, not over components directly.
Layer:     service
May import:   domain/{classifier, districts}, schemas/query, app.protocols (Generator port, for the
              constructor signature only), components/repository + embedder + hybrid_retriever +
              rate_limiter, pipeline/{base, simple, agent}, config, errors, metrics, structlog
Must NOT import:  other services/*, api/*, FastAPI/Starlette, asyncpg directly, openai directly (LLM
              failure classification now lives in pipeline.base._fallback_reason)
"""

from __future__ import annotations

import hashlib
import time
from collections import OrderedDict
from typing import cast

import structlog

from app.components.embedder import Embedder
from app.components.hybrid_retriever import HybridRetriever
from app.components.rate_limiter import current_window, evaluate, hash_user_id
from app.components.repository import KnowledgeRepository
from app.config import Settings
from app.domain.app_capabilities import match_app_capabilities
from app.domain.civic_intent import classify_civic_intent
from app.domain.civic_verification import is_civic_information_query, is_trusted_civic_source
from app.domain.classifier import QueryRoute, classify_query
from app.domain.districts import canonicalize_district
from app.errors import RateLimitedError
from app.metrics import district_unmapped, query_route_total
from app.pipeline.agent import AgentRAGPipeline
from app.pipeline.base import RagContext, RAGPipeline
from app.pipeline.simple import SimpleRAGPipeline
from app.protocols import Generator
from app.schemas.query import QueryRequest, QueryResponse

logger = structlog.get_logger(__name__)


_MAX_EXPOSED_SOURCES = 5


def _unique_sources(sources, limit: int = _MAX_EXPOSED_SOURCES):
    """Keep a small, ordered evidence set for the user-facing contract.

    Retrieval can use more chunks than a person should have to scan. Exposing every retrieved
    chunk also makes weak matches look like corroboration, so only the first unique source
    identities survive the groundedness gate.
    """
    seen = set()
    unique = []
    for source in sources:
        if len(unique) >= limit:
            break
        if source.source in seen:
            continue
        seen.add(source.source)
        unique.append(source)
    return unique


class _AnswerCache:
    """TTL + LRU cache over QueryResponse, keyed by normalized query + district slug. Avoids
    redundant LLM calls for repeated questions. Single-process asyncio use only — not
    thread-safe."""

    def __init__(self, maxsize: int, ttl_seconds: int) -> None:
        self._maxsize = maxsize
        self._ttl = ttl_seconds
        self._store: OrderedDict[str, tuple[QueryResponse, float]] = OrderedDict()

    def get(self, query: str, district: str | None, revision: int = 1) -> QueryResponse | None:
        key = self._make_key(query, district, revision)
        entry = self._store.get(key)
        if entry is None:
            return None
        response, inserted_at = entry
        if time.monotonic() - inserted_at > self._ttl:
            del self._store[key]
            return None
        self._store.move_to_end(key)
        return response

    def put(
        self, query: str, district: str | None, response: QueryResponse, revision: int = 1
    ) -> None:
        key = self._make_key(query, district, revision)
        self._store[key] = (response, time.monotonic())
        self._store.move_to_end(key)
        if len(self._store) > self._maxsize:
            self._store.popitem(last=False)

    @staticmethod
    def _make_key(query: str, district: str | None, revision: int = 1) -> str:
        raw = f"{query.lower().strip()}|{district or ''}|kb:{revision}"
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
            embedder,
            retriever,
            generator,
            settings.sim_gate,
            settings.sim_high,
            classification_cache_ttl_seconds=settings.classification_cache_ttl_seconds,
            classification_cache_maxsize=settings.classification_cache_maxsize,
        )
        self._agent = AgentRAGPipeline(
            embedder,
            retriever,
            generator,
            settings.sim_gate,
            settings.sim_high,
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
            logger.warning("query_unknown_district", raw=request.district)
            district_unmapped.labels(boundary="query").inc()

        # 3. Route. COMPLEX only reaches the agent pipeline when the feature flag is on; the
        #    response still carries the classifier's real decision either way (observability, §4.2).
        route = classify_query(request.user_query)
        query_route_total.labels(route=route.value).inc()
        if route is QueryRoute.COMPLEX and self._settings.agent_rag_enabled:
            pipeline: RAGPipeline = self._agent
        else:
            if route is QueryRoute.COMPLEX:
                logger.info("query_complex_fallback_to_simple", user=user_hash)
            pipeline = self._simple

        # 4. Answer cache (route re-stamped on the cached copy for observability).
        cached = self._cache.get(
            request.user_query, district_slug, self._settings.knowledge_base_version
        )
        if cached is not None:
            logger.info("query_cache_hit", user=user_hash, route=route.value)
            return cached.model_copy(update={"route": route})

        # 5. Run the selected pipeline — embedding, retrieval, and the shared confidence-gate ->
        #    generate -> extractive-fallback tail all live behind this call.
        civic_intent = classify_civic_intent(request.user_query)
        ctx = RagContext(
            user_query=request.user_query,
            district_slug=district_slug,
            route=route,
            category=civic_intent.category,
        )
        result = await pipeline.run(ctx)

        # 6. Map to the HTTP contract, log (user_id hashed; raw query only at DEBUG).
        grounded = bool(result.debug.get("grounded", False))
        civic_query = is_civic_information_query(request.user_query)
        civic_sources = [
            source
            for source in result.sources_used
            if is_trusted_civic_source(request.user_query, source.source)
        ]
        verified = (
            grounded
            and not bool(result.debug.get("verification_failed"))
            and (not civic_query or bool(civic_sources))
        )
        # Sources are evidence, not metadata about retrieval. Never expose them for an answer
        # that was not both grounded and verified; this keeps API clients from presenting
        # unrelated retrieval candidates as supporting sources.
        sources_used = (
            civic_sources if civic_query and verified else (result.sources_used if verified else [])
        )
        sources_used = _unique_sources(sources_used)
        response = QueryResponse(
            answer=result.answer,
            sources_used=sources_used,
            confidence=result.confidence,
            route=result.route,
            action_intent=result.action_intent,
            grounded=grounded,
            verified=verified,
            answer_status=(
                "blocked"
                if result.debug.get("blocked")
                else "verification_failed"
                if result.debug.get("verification_failed")
                else "grounded"
                if result.debug.get("grounded")
                else "ungrounded"
            ),
            app_links=(
                [] if result.debug.get("blocked") else match_app_capabilities(request.user_query)
            ),
        )
        if result.debug.get("blocked"):
            # Refused by the OPSEC content-safety gate (pipeline.base.check_query_safety) before
            # any retrieval/generation ran. Never cached — same staleness reasoning as no-info
            # below, plus a false-positive block on a legitimate civic question must never persist
            # for the whole TTL window just because it was asked once.
            logger.info(
                "query_blocked",
                user=user_hash,
                district=district_slug,
                route=route.value,
                took_ms=round(self._elapsed_ms(start), 1),
            )
        elif not result.debug.get("grounded"):
            # Ungrounded answers (real, conversational responses that weren't anchored to
            # specific KB chunks) are never cached — not because they're cheap to recompute
            # (they aren't anymore, an LLM call was made), but because an ungrounded reply isn't
            # tied to any particular retrieved content: caching it for the TTL window risks
            # serving a stale ungrounded answer even after the KB picks up content that would
            # have grounded this same query moments later.
            logger.info(
                "query_ungrounded",
                user=user_hash,
                district=district_slug,
                route=route.value,
                # debug is dict[str, object] (heterogeneous by design); top1_sim is always the
                # float set by pipeline.base's run_shared_tail.
                top1_sim=round(cast(float, result.debug.get("top1_sim", 0.0)), 3),
                took_ms=round(self._elapsed_ms(start), 1),
            )
        else:
            self._cache.put(
                request.user_query,
                district_slug,
                response,
                self._settings.knowledge_base_version,
            )
            logger.info(
                "query_ok",
                user=user_hash,
                district=district_slug,
                route=route.value,
                # debug is dict[str, object] (heterogeneous by design); top1_sim is always the
                # float set by pipeline.base's run_shared_tail/no-info branch.
                top1_sim=round(
                    cast(float, result.debug.get("top1_sim", 0.0)),
                    3,
                ),
                n_chunks=result.debug.get("n_chunks", 0),
                llm_ok=result.debug.get("llm_ok"),
                llm_retries=result.debug.get("llm_retries", 0),
                llm_ms=result.debug.get("llm_ms"),
                degraded=not result.debug.get("llm_ok", True),
                took_ms=round(self._elapsed_ms(start), 1),
            )
        logger.debug("query_text", user=user_hash, text=request.user_query)
        return response

    @staticmethod
    def _hash_user(user_id: str) -> str:
        """Grep-friendly 8-char log prefix, sharing rate_limiter.hash_user_id's digest rather than
        a second independent hash — the raw id is never logged or stored."""
        return hash_user_id(user_id)[:8]

    @staticmethod
    def _elapsed_ms(start: float) -> float:
        return (time.perf_counter() - start) * 1000
