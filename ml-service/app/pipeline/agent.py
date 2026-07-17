"""
Purpose:   AgentRAGPipeline(RAGPipeline): COMPLEX path via query DECOMPOSITION (not open-ended
           rewriting). decompose(query) -> <= max_subqueries sub-queries (1 Generator call) -> embed
           + hybrid-retrieve each IN PARALLEL (asyncio.gather(..., return_exceptions=True) — a
           sub-query whose retrieval raises degrades to an empty RetrievalOutcome, logged as a
           warning, rather than failing the whole request) -> is_sufficient per sub-query (a failed
           retrieval is just another form of dry), re-query at most ONE dry sub-query (a single
           SHARED re-query budget across the whole request — if several sub-queries are dry, only
           the FIRST by list order is rewritten and re-retried, the rest keep their original dry
           result) -> the per-sub-query fused lists are rank-interleaved (round-robin: every
           sub-query's rank-0 chunk before any sub-query's rank-1 chunk) so no single sub-query can
           starve the others out of the shared tail's token budget -> merge+dedup happens inside the
           shared tail's assemble_context -> one synthesis call. Worst case: 1 (decompose) + 1
           (rewrite) + 1 (synthesis) = 3 Generator calls. Also derives strong_lexical_match (any
           sub-query outcome whose own fused top-1 chunk agrees with its own lexical rank-1 pick)
           and passes it to the shared tail alongside agent_top1, mirroring SimpleRAGPipeline's
           identical per-outcome check — see pipeline.base.run_shared_tail's docstring for why this
           can ground an answer even when agent_top1 alone sits below sim_gate. AGENT_RAG_ENABLED
           gating and the fallback-to-SimpleRAGPipeline decision live in app.services.rag_service
           (the router), NOT here — AgentRAGPipeline.run() always runs the full agent flow when
           called.
Layer:     pipeline
May import:   pipeline/base, protocols (Embedder/Retriever/Generator), domain/{sufficiency,prompts},
              schemas/retrieval, app.metrics, stdlib (asyncio, json), structlog
Must NOT import:  api/*, services/*; concrete components/*; FastAPI, asyncpg, sentence-transformers
"""
from __future__ import annotations

import asyncio
import json

import structlog

from app.domain.civic_verification import (
    TITLE_NOT_SUPPORTED_ANSWER,
    extract_trusted_civic_title_answer,
    is_civic_title_query,
    normalize_civic_information_query,
    normalize_civic_title_query,
    verify_civic_context,
)
from app.domain.prompts import build_decompose_prompt, build_rewrite_prompt
from app.domain.sufficiency import is_sufficient
from app.metrics import agent_subqueries
from app.pipeline.base import RETRIEVE_LIMIT, RagContext, RAGPipeline, RagResult, run_shared_tail
from app.protocols import Embedder, Generator, Retriever
from app.schemas.retrieval import RetrievalOutcome, RetrievalResult

logger = structlog.get_logger(__name__)

# Short, near-deterministic internal calls — not the user-facing answer, so both temperature and
# max_tokens stay well below the main generation's 0.3 / 1024.
_DECOMPOSE_TEMPERATURE = 0.1
_DECOMPOSE_MAX_TOKENS = 200
_DECOMPOSE_TIMEOUT_S = 6.0

_REWRITE_TEMPERATURE = 0.2
_REWRITE_MAX_TOKENS = 60
_REWRITE_TIMEOUT_S = 4.0


def _interleave_by_rank(outcomes: list[RetrievalOutcome]) -> list[RetrievalResult]:
    """Round-robin merge: rank-0 chunk from every sub-query first, then rank-1 from every
    sub-query, etc. Ensures no single sub-query's results can starve the others out of the
    downstream token budget before assemble_context's own dedup/trim runs."""
    lists = [outcome.fused for outcome in outcomes]
    max_len = max((len(lst) for lst in lists), default=0)
    interleaved: list[RetrievalResult] = []
    for i in range(max_len):
        for lst in lists:
            if i < len(lst):
                interleaved.append(lst[i])
    return interleaved


def _outcome_or_dry(subquery: str, result: RetrievalOutcome | BaseException) -> RetrievalOutcome:
    """A sub-query's retrieval failing (e.g. a transient DB error) degrades to an empty outcome
    instead of propagating — the empty outcome is indistinguishable from a genuinely dry sub-query,
    so it's picked up by the existing is_sufficient/re-query logic like any other dry sub-query."""
    if isinstance(result, BaseException):
        logger.warning("agent_retrieve_failed", subquery=subquery, err=type(result).__name__)
        return RetrievalOutcome(dense=[], fused=[])
    return result


class AgentRAGPipeline(RAGPipeline):
    """COMPLEX-route pipeline: decompose -> parallel retrieve -> single bounded re-query -> shared
    tail. See module docstring for the exact bound on Generator calls."""

    def __init__(
        self,
        embedder: Embedder,
        retriever: Retriever,
        generator: Generator,
        sim_gate: float,
        sim_high: float,
        max_subqueries: int,
    ) -> None:
        self._embedder = embedder
        self._retriever = retriever
        self._generator = generator
        self._sim_gate = sim_gate
        self._sim_high = sim_high
        self._max_subqueries = max_subqueries

    async def run(self, ctx: RagContext) -> RagResult:
        # Office-holder questions are high-risk and usually short. Decomposition adds an LLM
        # round-trip without improving retrieval, and can mutate the title relation before the
        # deterministic evidence guard sees it. Retrieve the original wording directly instead.
        subqueries = (
            [normalize_civic_information_query(normalize_civic_title_query(ctx.user_query))]
            if is_civic_title_query(ctx.user_query)
            else await self._decompose(ctx.user_query)
        )
        agent_subqueries.observe(len(subqueries))

        outcomes = await self._retrieve_all(subqueries, ctx.district_slug, ctx.category)

        dry_indices = [
            i for i, outcome in enumerate(outcomes)
            if not is_sufficient(outcome.dense, self._sim_gate)
        ]
        if dry_indices:
            # Single shared re-query budget: only the FIRST dry sub-query (by list order) gets
            # rewritten and re-retried, even if others are also dry.
            first_dry = dry_indices[0]
            outcomes[first_dry] = await self._reretry_dry(
                subqueries[first_dry], outcomes[first_dry], ctx.district_slug, ctx.category
            )

        flattened = _interleave_by_rank(outcomes)
        verification = verify_civic_context(
            ctx.user_query, [item.text for item in flattened]
        )
        if verification.blocked:
            return RagResult(
                answer=TITLE_NOT_SUPPORTED_ANSWER,
                sources_used=[],
                confidence=0.0,
                route=ctx.route,
                debug={"grounded": False, "verification_failed": verification.reason},
            )
        agent_top1 = max((outcome.dense_top1_sim for outcome in outcomes), default=0.0)
        # True when ANY sub-query's own outcome has a strong lexical match (RetrievalOutcome
        # .has_strong_lexical_match — mirrors SimpleRAGPipeline's per-outcome check), reduced with
        # `any(...)` across sub-queries: one strongly lexically-grounded chunk anywhere in the
        # interleaved context is enough, even if the overall agent_top1 (max dense similarity
        # across all sub-queries) sits below sim_gate.
        strong_lexical_match = any(outcome.has_strong_lexical_match for outcome in outcomes)

        return await run_shared_tail(
            generator=self._generator,
            sim_gate=self._sim_gate,
            sim_high=self._sim_high,
            count_tokens_fn=self._embedder.count_tokens,
            retrieved=flattened,
            top1_sim=agent_top1,
            question=ctx.user_query,
            route=ctx.route,
            strong_lexical_match=strong_lexical_match,
            deterministic_answer=extract_trusted_civic_title_answer(
                ctx.user_query, [(item.text, item.source) for item in flattened]
            ),
        )

    async def _retrieve_all(
        self, subqueries: list[str], district: str | None, category: str | None = None
    ) -> list[RetrievalOutcome]:
        """Fan out one retrieval per sub-query in parallel. return_exceptions=True: a single
        sub-query's transient retrieval failure (e.g. a dropped DB connection) must not abort the
        whole request (ADR-007) — _outcome_or_dry turns it into an empty (dry) outcome instead,
        which the existing is_sufficient/re-query logic then treats like any other dry sub-query."""
        raw_results = await asyncio.gather(
            *(self._retrieve_one(sq, district, category) for sq in subqueries),
            return_exceptions=True,
        )
        return [
            _outcome_or_dry(sq, result)
            for sq, result in zip(subqueries, raw_results, strict=True)
        ]

    async def _reretry_dry(
        self, subquery: str, current: RetrievalOutcome, district: str | None,
        category: str | None = None,
    ) -> RetrievalOutcome:
        """Rewrites `subquery` and re-retrieves once — the single shared re-query budget. A failed
        re-query keeps `current` (the sub-query's original, already-dry outcome) rather than 500ing
        the whole request — same graceful-degradation contract as the initial fan-out."""
        rewritten = await self._rewrite(subquery)
        try:
            return await self._retrieve_one(rewritten, district, category)
        except Exception as exc:  # noqa: BLE001
            logger.warning("agent_retrieve_failed", subquery=rewritten, err=type(exc).__name__)
            return current

    async def _retrieve_one(self, query_text: str, district: str | None, category: str | None = None) -> RetrievalOutcome:
        query_vec = await self._embedder.encode_query(query_text)
        return await self._retriever.retrieve(query_text, query_vec, district, k=RETRIEVE_LIMIT, category=category)

    async def _decompose(self, query: str) -> list[str]:
        """1 Generator call. Any parse failure, non-list, empty list, or non-string element degrades
        to [query] (agent behaves like simple for this request rather than raising) — logged as a
        warning in every degrade case."""
        prompt = build_decompose_prompt(query, self._max_subqueries)
        try:
            raw, _ = await self._generator.generate(
                prompt,
                temperature=_DECOMPOSE_TEMPERATURE,
                max_tokens=_DECOMPOSE_MAX_TOKENS,
                timeout_s=_DECOMPOSE_TIMEOUT_S,
            )
            parsed = json.loads(raw)
        except Exception as exc:  # noqa: BLE001 — any decompose failure degrades to a single sub-query
            logger.warning("agent_decompose_failed", err=type(exc).__name__)
            return [query]

        if not isinstance(parsed, list) or not all(isinstance(item, str) for item in parsed):
            logger.warning("agent_decompose_bad_shape", raw=raw)
            return [query]

        subqueries = [item.strip() for item in parsed[: self._max_subqueries] if item.strip()]
        if not subqueries:
            logger.warning("agent_decompose_empty_after_filter", raw=raw)
            return [query]
        return subqueries

    async def _rewrite(self, subquery: str) -> str:
        """1 Generator call (only reached if some sub-query was dry). On any failure, or an
        empty-after-strip reply, keep the original subquery text — never raise out of this
        method."""
        prompt = build_rewrite_prompt(subquery)
        try:
            raw, _ = await self._generator.generate(
                prompt,
                temperature=_REWRITE_TEMPERATURE,
                max_tokens=_REWRITE_MAX_TOKENS,
                timeout_s=_REWRITE_TIMEOUT_S,
            )
        except Exception as exc:  # noqa: BLE001 — a failed rewrite falls back to the original sub-query
            logger.warning("agent_rewrite_failed", err=type(exc).__name__)
            return subquery

        rewritten = raw.strip()
        return rewritten if rewritten else subquery
