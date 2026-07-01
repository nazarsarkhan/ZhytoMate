"""
Purpose:   RAGPipeline(ABC).run(ctx: RagContext) -> RagResult — the contract both branches honour so
           they converge on one shared tail, implemented here as run_shared_tail(): confidence gate
           -> generate -> extractive fallback on any LLM error (ADR-007). Defines RagContext
           (user_query, district_slug, route) and RagResult (answer, sources_used, confidence,
           route, debug) as pydantic v2 internal DTOs (not HTTP I/O — that stays schemas/query).
           RagContext deliberately carries NO pre-computed query vector: AgentRAGPipeline embeds
           MULTIPLE sub-queries that don't exist until after its own decompose call, so each
           pipeline embeds its own query text(s) internally via the injected Embedder port rather
           than receiving one upfront.
Layer:     pipeline
May import:   stdlib (abc, asyncio, time, collections.abc), structlog, pydantic,
              app.protocols (Generator), schemas/*, domain/{confidence, context, prompts},
              app.metrics; openai (exception types only, for classifying a fallback reason in
              _fallback_reason — never to make an API call directly)
Must NOT import:  api/*, services/*; concrete components/*; FastAPI, asyncpg, sentence-transformers;
              openai beyond the narrow exception-type import noted above
"""
from __future__ import annotations

import asyncio
import time
from abc import ABC, abstractmethod
from collections.abc import Callable

import structlog
from openai import APIError, APITimeoutError
from pydantic import BaseModel, Field

from app.domain.confidence import ConfidenceBand, confidence_band
from app.domain.context import CONTEXT_TOKEN_BUDGET, assemble_context
from app.domain.prompts import build_rag_prompt
from app.metrics import (
    degraded_responses,
    llm_calls,
    llm_latency_seconds,
    retrieval_empty,
    retrieval_top1_sim,
)
from app.protocols import Generator
from app.schemas.common import QueryRoute
from app.schemas.query import SourceUsed
from app.schemas.retrieval import RetrievalResult

logger = structlog.get_logger(__name__)

_NO_INFO_ANSWER = "Поки що немає інформації за цим запитом."
_FALLBACK_PREFIX = "За наявними даними: "
RETRIEVE_LIMIT = 10  # shared by both pipelines; no leading underscore since it's imported by them
_GENERATE_TIMEOUT_S = 8.0
_GENERATION_TEMPERATURE = 0.3
_MAX_OUTPUT_TOKENS = 1024
_FALLBACK_CONFIDENCE_CAP = 0.5


class RagContext(BaseModel):
    """Internal input to RAGPipeline.run() — not the HTTP request body (that's schemas.query)."""

    user_query: str
    district_slug: str | None
    route: QueryRoute


class RagResult(BaseModel):
    """Internal output of RAGPipeline.run(). `debug` carries fields the router needs for structured
    logging (top1_sim, band, n_chunks, llm_ok, llm_retries, no_info) without widening the pydantic
    schema for values that are never part of the HTTP contract."""

    answer: str
    sources_used: list[SourceUsed]
    confidence: float
    route: QueryRoute
    debug: dict[str, object] = Field(default_factory=dict)


class RAGPipeline(ABC):
    @abstractmethod
    async def run(self, ctx: RagContext) -> RagResult: ...


async def run_shared_tail(
    *,
    generator: Generator,
    sim_gate: float,
    sim_high: float,
    count_tokens_fn: Callable[[str], int],
    retrieved: list[RetrievalResult],
    top1_sim: float,
    question: str,
    route: QueryRoute,
) -> RagResult:
    """The ONE place the confidence-gate -> generate -> extractive-fallback tail lives (ADR-007).
    Both SimpleRAGPipeline and AgentRAGPipeline call this after producing their own
    (retrieved, top1_sim) — this is what makes the two branches converge on identical no-info /
    fallback behavior without duplicating it."""
    retrieval_top1_sim.observe(top1_sim)
    band = confidence_band(top1_sim, sim_gate, sim_high)
    if not retrieved or band is ConfidenceBand.NO_INFO:
        retrieval_empty.inc()
        return RagResult(
            answer=_NO_INFO_ANSWER, sources_used=[], confidence=0.0, route=route,
            debug={"no_info": True, "top1_sim": top1_sim, "band": band.value, "n_chunks": 0},
        )

    top_results = assemble_context(retrieved, CONTEXT_TOKEN_BUDGET, count_tokens_fn)
    context_chunks = [r.text for r in top_results]
    prompt = build_rag_prompt(context_chunks, question)
    route_label = route.value.lower()
    llm_ok = True
    retries = 0
    llm_start = time.perf_counter()
    try:
        answer, retries = await generator.generate(
            prompt, temperature=_GENERATION_TEMPERATURE, max_tokens=_MAX_OUTPUT_TOKENS,
            timeout_s=_GENERATE_TIMEOUT_S,
        )
        confidence = round(top1_sim, 2)
        llm_calls.labels(route=route_label, outcome="ok").inc()
    except Exception as exc:  # noqa: BLE001 — LLM is the least reliable hop; demo must stay alive (ADR-007)
        llm_ok = False
        answer = _FALLBACK_PREFIX + top_results[0].text
        confidence = min(round(top1_sim, 2), _FALLBACK_CONFIDENCE_CAP)
        reason = _fallback_reason(exc)
        llm_calls.labels(route=route_label, outcome="fallback").inc()
        degraded_responses.labels(reason=reason).inc()
        logger.warning(
            "pipeline_llm_fallback", route=route.value, err=type(exc).__name__, reason=reason
        )
    finally:
        # Timed around the whole try/except — a failed/timed-out call's latency is just as
        # operationally interesting as a successful one's.
        llm_elapsed_s = time.perf_counter() - llm_start
        llm_latency_seconds.observe(llm_elapsed_s)

    sources = [
        SourceUsed(
            source=r.source,
            doc_type=r.doc_type,
            district=r.district,
            similarity=round(r.similarity, 4),
        )
        for r in top_results
    ]
    return RagResult(
        answer=answer, sources_used=sources, confidence=confidence, route=route,
        debug={
            "no_info": False, "top1_sim": top1_sim, "band": band.value,
            "n_chunks": len(top_results), "llm_ok": llm_ok, "llm_retries": retries,
            "llm_ms": round(llm_elapsed_s * 1000, 1),
        },
    )


def _fallback_reason(exc: Exception) -> str:
    """Classify an LLM failure for the degraded_responses metric. (Lifted from the old
    rag_service.py — identical logic, now shared by both pipelines instead of duplicated.)"""
    if isinstance(exc, APIError) and getattr(exc, "status_code", None) == 429:
        return "llm_quota"
    if isinstance(exc, (APITimeoutError, asyncio.TimeoutError, TimeoutError)):
        return "llm_timeout"
    return "llm_error"
