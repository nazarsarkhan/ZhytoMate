"""
Purpose:   SimpleRAGPipeline(RAGPipeline): single-shot path for SIMPLE queries — embed the query (no
           prefix; OpenAI embeddings are prefix-free, unlike the old e5 setup) -> hybrid retrieve
           (dense+lexical, RRF) via the injected Retriever port -> shared tail (confidence gate;
           generate or no-info; extractive fallback on LLM error) via pipeline.base.run_shared_tail.
           One Generator call max.
Layer:     pipeline
May import:   pipeline/base, protocols (Embedder/Retriever/Generator)
Must NOT import:  api/*, services/*; concrete components/*; FastAPI, asyncpg, sentence-transformers
"""
from __future__ import annotations

from app.pipeline.base import RETRIEVE_LIMIT, RAGPipeline, RagContext, RagResult, run_shared_tail
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
        query_vec = await self._embedder.encode_query(ctx.user_query)
        outcome = await self._retriever.retrieve(
            ctx.user_query, query_vec, ctx.district_slug, k=RETRIEVE_LIMIT
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
        )
