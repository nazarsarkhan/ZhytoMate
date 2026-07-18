"""
Purpose:   SimpleRAGPipeline(RAGPipeline): single-shot path for SIMPLE queries — OPSEC content-
           safety gate first (check_query_safety; an unsafe query short-circuits with a refusal,
           never reaching retrieval or generation) -> detect language + translate the query to
           Ukrainian for retrieval if needed (detect_and_translate; skipped for Ukrainian queries)
           -> embed the query (no prefix; OpenAI embeddings are prefix-free, unlike the old e5
           setup) -> hybrid retrieve (dense+lexical, RRF) via the injected Retriever port -> derive
           strong_lexical_match (does the fused list's own top-1 chunk agree with the lexical
           leg's own rank-1 pick?) -> shared tail (confidence gate decides grounded vs ungrounded,
           now via EITHER a passing top1_sim OR strong_lexical_match; ALWAYS generates either way;
           fallback on LLM error) via pipeline.base.run_shared_tail. At most one safety-check
           call, plus one generation call, plus at most one detect+translate call for a non-
           Ukrainian query. Generation receives the ORIGINAL query and the policy-resolved
           answer_lang, so the answer keeps the user's language — except Russian, which this
           assistant never answers in (wartime policy; see domain.language.resolve_answer_lang).
Layer:     pipeline
May import:   pipeline/base, protocols (Embedder/Retriever/Generator)
Must NOT import:  api/*, services/*; concrete components/*; FastAPI, asyncpg, sentence-transformers
"""
from __future__ import annotations

import asyncio
import time

from app.domain.civic_verification import (
    TITLE_NOT_SUPPORTED_ANSWER,
    extract_trusted_civic_answer,
    is_civic_information_query,
    normalize_civic_information_query,
    normalize_civic_title_query,
    verify_civic_context,
)
from app.domain.civic_glossary import glossary_retrieval_query
from app.metrics import classification_cache_hits_total, classification_cache_lookups_total
from app.domain.language import is_ukrainian
from app.pipeline.base import (
    RETRIEVE_LIMIT,
    RagContext,
    RAGPipeline,
    RagResult,
    check_query_safety_and_translate,
    run_shared_tail,
)
from app.protocols import Embedder, Generator, Retriever


class SimpleRAGPipeline(RAGPipeline):
    """Single-shot RAG: one retrieve, one (possible) generate call. No decomposition, no re-query —
    that's AgentRAGPipeline's job."""

    def __init__(
        self,
        embedder: Embedder,
        retriever: Retriever,
        generator: Generator,
        sim_gate: float,
        sim_high: float,
        classification_cache_ttl_seconds: int = 30,
        classification_cache_maxsize: int = 256,
    ) -> None:
        self._embedder = embedder
        self._retriever = retriever
        self._generator = generator
        self._sim_gate = sim_gate
        self._sim_high = sim_high
        self._classification_cache_ttl = max(0, classification_cache_ttl_seconds)
        self._classification_cache_maxsize = max(1, classification_cache_maxsize)
        self._classification_cache: dict[str, tuple[float, tuple[bool, str, bool, str | None, str, str]]] = {}
        self._classification_lock = asyncio.Lock()

    async def _classify(self, query: str) -> tuple[bool, str, bool, str | None, str, str]:
        key = " ".join(query.lower().split())
        now = time.monotonic()
        classification_cache_lookups_total.inc()
        cached = self._classification_cache.get(key)
        if cached and cached[0] > now:
            classification_cache_hits_total.inc()
            return cached[1]
        async with self._classification_lock:
            now = time.monotonic()
            cached = self._classification_cache.get(key)
            if cached and cached[0] > now:
                classification_cache_hits_total.inc()
                return cached[1]
            result = await check_query_safety_and_translate(self._generator, query)
            if result[0] and self._classification_cache_ttl:
                if len(self._classification_cache) >= self._classification_cache_maxsize:
                    self._classification_cache.pop(next(iter(self._classification_cache)))
                self._classification_cache[key] = (now + self._classification_cache_ttl, result)
            return result

    async def run(self, ctx: RagContext) -> RagResult:
        # Wartime OPSEC gate first, before any retrieval/generation work — see
        # pipeline.base.check_query_safety for the two-layer (heuristic + LLM) design and the
        # fail-closed policy. conversational feeds run_shared_tail's force_ungrounded below, so a
        # greeting doesn't get routed to the civic RAG prompt just because retrieval's similarity
        # gate happened to clear on vocabulary/style noise.
        is_safe, refusal, conversational, action_intent, answer_lang, retrieval_query = await self._classify(ctx.user_query)
        if not is_safe:
            return RagResult(
                answer=refusal, sources_used=[], confidence=0.0, route=ctx.route,
                debug={"blocked": True},
            )

        # The combined classifier already translated non-Ukrainian input. Apply the deterministic
        # civic canonicalizers after that translation so short title/service queries retrieve the
        # canonical KB wording without spending another LLM round-trip.
        # Prefer the user's original civic wording for deterministic canonicalization. The safety
        # classifier may paraphrase even Ukrainian input (especially short questions such as
        # "Які телефони ЦНАП?"), which can erase the service anchor before lexical retrieval sees
        # it. Non-civic foreign-language input still uses the classifier's translated query.
        glossary_query = glossary_retrieval_query(ctx.user_query)
        if glossary_query:
            # Glossary anchors must win for every input language. Otherwise Russian VPO queries
            # rely on an LLM translation that can lose the local service vocabulary entirely.
            retrieval_query = glossary_query
        elif is_ukrainian(ctx.user_query) and is_civic_information_query(ctx.user_query):
            retrieval_query = normalize_civic_information_query(
                normalize_civic_title_query(ctx.user_query)
            )
        else:
            retrieval_query = normalize_civic_title_query(retrieval_query)
        query_vec = await self._embedder.encode_query(retrieval_query)
        outcome = await self._retriever.retrieve(
            retrieval_query, query_vec, ctx.district_slug, k=RETRIEVE_LIMIT, category=ctx.category
        )
        verification = verify_civic_context(
            ctx.user_query, [item.text for item in outcome.fused]
        )
        if verification.blocked:
            return RagResult(
                answer=TITLE_NOT_SUPPORTED_ANSWER,
                sources_used=[],
                confidence=0.0,
                route=ctx.route,
                action_intent=action_intent,
                debug={"grounded": False, "verification_failed": verification.reason},
            )
        # A genuine rank-1 agreement between the fused list and the raw lexical leg (excluding a
        # degenerate single-common-word OR-fallback coincidence — see RetrievalOutcome
        # .has_strong_lexical_match) grounds an answer even when dense top1_sim alone sits below
        # sim_gate; see run_shared_tail's docstring for why.
        strong_lexical_match = outcome.has_strong_lexical_match
        result = await run_shared_tail(
            generator=self._generator,
            sim_gate=self._sim_gate,
            sim_high=self._sim_high,
            count_tokens_fn=self._embedder.count_tokens,
            retrieved=outcome.fused,
            top1_sim=outcome.dense_top1_sim,
            question=ctx.user_query,
            route=ctx.route,
            answer_lang=answer_lang,
            force_ungrounded=conversational and not is_civic_information_query(ctx.user_query),
            strong_lexical_match=strong_lexical_match,
            deterministic_answer=extract_trusted_civic_answer(
                normalize_civic_information_query(ctx.user_query),
                [(item.text, item.source) for item in outcome.fused],
            ),
        )
        return result.model_copy(update={"action_intent": action_intent})
