"""
Purpose:   HybridRetriever(Retriever): the concrete adapter behind the Retriever port. Runs the
           dense (pgvector) and lexical (tsvector) legs concurrently via KnowledgeRepository, then
           fuses them with reciprocal_rank_fusion. Pure relocation of rag_service.py's former
           inline retrieval step (Phases 1-3) into its own component — no new SQL, no new fusion
           logic. Both RAG pipelines (SimpleRAGPipeline, AgentRAGPipeline) depend on the Retriever
           port for this, and this is its only implementation.
Layer:     component
May import:   stdlib (asyncio), numpy, app.protocols (Retriever), app.components.repository
              (KnowledgeRepository — the one component this module is explicitly allowed to wrap,
              since adapting it to the Retriever port IS this module's job), app.domain.fusion,
              app.schemas.retrieval, app.metrics
Must NOT import:  services/*, api/*, pipeline/*, other components/* (repository is the sole,
              intentional exception noted above)
"""
from __future__ import annotations

import asyncio

import numpy as np

from app.components.repository import KnowledgeRepository
from app.domain.fusion import reciprocal_rank_fusion
from app.metrics import retrieval_leg_hits
from app.protocols import Retriever
from app.schemas.retrieval import RetrievalOutcome


class HybridRetriever(Retriever):
    """Adapts KnowledgeRepository's two retrieval legs to the Retriever port: dense + lexical run
    concurrently, then RRF-fuse. Stateless beyond the injected repo and the RRF smoothing
    constant."""

    def __init__(self, repo: KnowledgeRepository, rrf_k: int) -> None:
        self._repo = repo
        self._rrf_k = rrf_k

    async def retrieve(
        self, query_text: str, query_vec: np.ndarray, district: str | None, k: int
    ) -> RetrievalOutcome:
        dense, lexical = await asyncio.gather(
            self._repo.retrieve_dense(query_vec, district, limit=k),
            self._repo.retrieve_lexical(query_text, district, limit=k),
        )
        retrieval_leg_hits.labels(leg="dense").inc(len(dense))
        retrieval_leg_hits.labels(leg="lexical").inc(len(lexical))
        fused = reciprocal_rank_fusion(dense, lexical, k=self._rrf_k)
        return RetrievalOutcome(dense=dense, fused=fused)
