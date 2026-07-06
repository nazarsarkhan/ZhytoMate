"""
Purpose:   SimpleRAGPipeline(RAGPipeline): single-shot path for SIMPLE queries — OPSEC content-
           safety gate first (check_query_safety; an unsafe query short-circuits with a refusal,
           never reaching retrieval or generation) -> detect language + translate the query to
           Ukrainian for retrieval if needed (detect_and_translate; skipped for Ukrainian queries)
           -> embed the query (no prefix; OpenAI embeddings are prefix-free, unlike the old e5
           setup) -> hybrid retrieve (dense+lexical, RRF) via the injected Retriever port -> shared
           tail (confidence gate decides grounded vs ungrounded; ALWAYS generates either way;
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

from app.pipeline.base import (
    RETRIEVE_LIMIT,
    RagContext,
    RAGPipeline,
    RagResult,
    check_query_safety,
    detect_and_translate,
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
    ) -> None:
        self._embedder = embedder
        self._retriever = retriever
        self._generator = generator
        self._sim_gate = sim_gate
        self._sim_high = sim_high

    async def run(self, ctx: RagContext) -> RagResult:
        # Wartime OPSEC gate first, before any retrieval/generation work — see
        # pipeline.base.check_query_safety for the two-layer (heuristic + LLM) design and the
        # fail-closed policy. conversational feeds run_shared_tail's force_ungrounded below, so a
        # greeting doesn't get routed to the civic RAG prompt just because retrieval's similarity
        # gate happened to clear on vocabulary/style noise.
        is_safe, refusal, conversational = await check_query_safety(
            self._generator, ctx.user_query
        )
        if not is_safe:
            return RagResult(
                answer=refusal, sources_used=[], confidence=0.0, route=ctx.route,
                debug={"blocked": True},
            )

        # The KB is Ukrainian; for a RU/EN query, detect its language and translate it to Ukrainian
        # for retrieval in one call (a Ukrainian query skips it). Generation still gets the ORIGINAL
        # query and answers in answer_lang, so the reply comes back in the user's language (never
        # Russian — answer_lang is already policy-resolved by detect_and_translate).
        answer_lang, retrieval_query = await detect_and_translate(self._generator, ctx.user_query)
        query_vec = await self._embedder.encode_query(retrieval_query)
        outcome = await self._retriever.retrieve(
            retrieval_query, query_vec, ctx.district_slug, k=RETRIEVE_LIMIT
        )
        return await run_shared_tail(
            generator=self._generator,
            sim_gate=self._sim_gate,
            sim_high=self._sim_high,
            count_tokens_fn=self._embedder.count_tokens,
            retrieved=outcome.fused,
            top1_sim=outcome.dense_top1_sim,
            question=ctx.user_query,
            route=ctx.route,
            answer_lang=answer_lang,
            force_ungrounded=conversational,
        )
