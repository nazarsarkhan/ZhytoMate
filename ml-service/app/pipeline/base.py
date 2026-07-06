"""
Purpose:   RAGPipeline(ABC).run(ctx: RagContext) -> RagResult — the contract both branches honour so
           they converge on one shared tail, implemented here as run_shared_tail(): confidence gate
           decides `grounded` -> ALWAYS generate (grounded via build_rag_prompt, or ungrounded/
           conversational via build_general_prompt) -> extractive fallback on any LLM error for a
           grounded answer, or an honest "couldn't respond" message for an ungrounded one (ADR-007
           extended — the LLM is still the least reliable hop, so a demo must stay alive either
           way). Defines RagContext (user_query, district_slug, route) and RagResult (answer,
           sources_used, confidence, route, debug) as pydantic v2 internal DTOs (not HTTP I/O —
           that stays schemas/query). RagContext deliberately carries NO pre-computed query
           vector: AgentRAGPipeline embeds MULTIPLE sub-queries that don't exist until after its
           own decompose call, so each pipeline embeds its own query text(s) internally via the
           injected Embedder port rather than receiving one upfront. Also exposes
           detect_and_translate(): the shared multilingual entrypoint that (for a non-Ukrainian
           query) detects the language and translates it into Ukrainian for retrieval in one
           call, returning (answer_lang, retrieval_query) so run_shared_tail can answer in
           answer_lang — answer_lang is always resolved through domain.language.resolve_answer_lang
           before it's returned, so it is never "ru" (wartime policy: never answer in Russian,
           regardless of the question's language). Ukrainian queries skip the call entirely. Also
           exposes check_query_safety(): a two-layer OPSEC content-safety gate (fast keyword
           heuristic, then an LLM classification pass) that SimpleRAGPipeline.run() calls first,
           before any retrieval/generation — an unsafe query short-circuits with a refusal, never
           reaching the KB or the main generation call. This safety gate and the answer-language
           policy both apply unconditionally to every query, grounded or not. The same call also
           classifies action_intent — one of domain.actions.KNOWN_ACTIONS's names, or None — so a
           later layer (not this one) can route a query like "create an appeal about a pothole"
           into a slot-collection flow instead of an ordinary answer.
Layer:     pipeline
May import:   stdlib (abc, asyncio, json, time, collections.abc), structlog, pydantic,
              app.protocols (Generator), schemas/*, domain/{actions, confidence, context, language,
              opsec, prompts}, app.metrics; openai (exception types only, for classifying a
              fallback reason in _fallback_reason — never to make an API call directly)
Must NOT import:  api/*, services/*; concrete components/*; FastAPI, asyncpg, sentence-transformers;
              openai beyond the narrow exception-type import noted above
"""
from __future__ import annotations

import asyncio
import json
import time
from abc import ABC, abstractmethod
from collections.abc import Callable

import structlog
from openai import APIError, APITimeoutError
from pydantic import BaseModel, Field

from app.domain.actions import KNOWN_ACTIONS
from app.domain.confidence import ConfidenceBand, confidence_band
from app.domain.context import CONTEXT_TOKEN_BUDGET, assemble_context
from app.domain.language import detect_query_language, is_ukrainian, resolve_answer_lang
from app.domain.opsec import contains_opsec_risk_terms
from app.domain.prompts import (
    build_detect_and_translate_prompt,
    build_general_prompt,
    build_rag_prompt,
    build_safety_check_prompt,
)
from app.metrics import (
    degraded_responses,
    llm_calls,
    llm_latency_seconds,
    queries_blocked_total,
    retrieval_empty,
    retrieval_top1_sim,
)
from app.protocols import Generator
from app.schemas.common import QueryRoute
from app.schemas.query import SourceUsed
from app.schemas.retrieval import RetrievalResult

logger = structlog.get_logger(__name__)

# Emergency double-fallback: reached only when retrieval didn't ground an answer AND the
# ungrounded, general-conversation generate call itself failed (timeout/network/API error).
# Deliberately NOT phrased as "no info" — that would misrepresent a transient LLM/network failure
# as "the knowledge base doesn't cover this", which usually isn't why this branch was reached.
# No "ru" entry, matching _ANSWER_LANG_DIRECTIVE (domain/prompts.py) — see that dict's comment for
# why: wartime policy is to never answer in Russian, and the .get(lang, ["uk"]) fallback below is a
# second, independent layer of that same policy.
_GENERATION_UNAVAILABLE_BY_LANG = {
    "uk": "Наразі не вдалося сформувати відповідь. Спробуйте, будь ласка, ще раз.",
    "en": "I wasn't able to generate a response right now. Please try again.",
}
# Refusal shown when check_query_safety() flags a query as unsafe (OPSEC risk) — deliberately
# generic (never explains WHY, never echoes the query) so a refusal doesn't itself leak information
# about what was detected or how.
_REFUSAL_ANSWER_BY_LANG = {
    "uk": "Вибачте, я не можу відповісти на це запитання.",
    "en": "Sorry, I can't answer that question.",
}
_FALLBACK_PREFIX = "За наявними даними: "
RETRIEVE_LIMIT = 10  # shared by both pipelines; no leading underscore since it's imported by them
_GENERATE_TIMEOUT_S = 8.0
_GENERATION_TEMPERATURE = 0.3
_MAX_OUTPUT_TOKENS = 1024
_FALLBACK_CONFIDENCE_CAP = 0.5

# Combined language-detect + query translation (multilingual entrypoint). Deterministic and short —
# not the user-facing answer, just detection + the search query rendered into the KB's language.
_TRANSLATE_TEMPERATURE = 0.0
_TRANSLATE_MAX_TOKENS = 256
_TRANSLATE_TIMEOUT_S = 5.0
_VALID_LANGS = frozenset({"uk", "ru", "en"})

# OPSEC content-safety classification (layer 2 — see check_query_safety). A true/false
# classification, not a user-facing answer: short, deterministic, cheap. 96 tokens (not the bare
# minimum a clean {"safe": bool, "conversational": bool, "action_intent": str | null} needs) leaves
# real headroom now that json_mode=True enforces valid JSON at the API level — see
# components.llm.OpenAILLMClient. Bumped from 64: the JSON payload grew a third field plus room for
# the longest registered action name.
_SAFETY_CHECK_TEMPERATURE = 0.0
_SAFETY_CHECK_MAX_TOKENS = 96
_SAFETY_CHECK_TIMEOUT_S = 5.0


async def detect_and_translate(generator: Generator, query: str) -> tuple[str, str]:
    """Detect the query language AND produce its Ukrainian form for retrieval in ONE call. Returns
    (answer_lang, retrieval_query). A query already carrying a Ukrainian-only letter skips the call
    entirely -> ("uk", query). Otherwise one Generator call returns JSON {lang, uk}: the KB is
    Ukrainian, so RU/EN queries must be translated to retrieve well (measured: EN civic ~0.42–0.59
    vs UA ~0.56–0.70 against a 0.50 gate). The detected lang is always collapsed through
    domain.language.resolve_answer_lang before it's returned, so answer_lang is never "ru" —
    wartime policy: this assistant never answers in Russian, regardless of the question's
    language (only the retrieval-time translation reads the raw detected lang). Any failure or
    malformed reply degrades to (charset-detected lang, original query), policy-resolved the same
    way: retrieval runs, just at the original language's lower similarity — never worse than not
    translating at all."""
    if is_ukrainian(query):
        return "uk", query
    try:
        raw, _ = await generator.generate(
            build_detect_and_translate_prompt(query),
            temperature=_TRANSLATE_TEMPERATURE,
            max_tokens=_TRANSLATE_MAX_TOKENS,
            timeout_s=_TRANSLATE_TIMEOUT_S,
        )
        parsed = json.loads(raw[raw.find("{") : raw.rfind("}") + 1])
        raw_lang = parsed.get("lang")
        lang = raw_lang if raw_lang in _VALID_LANGS else detect_query_language(query)
        translated = (parsed.get("uk") or "").strip()
        retrieval_query = translated or query
    except Exception as exc:  # noqa: BLE001 — best-effort; the charset fallback keeps the request alive
        logger.warning("query_detect_translate_failed", err=type(exc).__name__)
        return resolve_answer_lang(detect_query_language(query)), query
    return resolve_answer_lang(lang), retrieval_query


async def check_query_safety(
    generator: Generator, query: str
) -> tuple[bool, str, bool, str | None]:
    """Two-layer wartime OPSEC content-safety gate. Layer 1 is the free, instant keyword heuristic
    (domain.opsec.contains_opsec_risk_terms) — if it flags the query, the LLM is never called.
    Layer 2, reached only if layer 1 passes, is an LLM classification pass that catches paraphrased
    or creative attempts the fixed phrase list cannot. Returns (is_safe, refusal_answer,
    conversational, action_intent); the refusal text is only meaningful when is_safe is False, and
    its language is always resolve_answer_lang(detect_query_language(query)) so a refusal can
    never itself violate the answer-language policy. FAIL CLOSED: any classifier exception
    (timeout, network error, malformed JSON, missing/wrong-typed "safe" key) is treated as UNSAFE,
    not safe — an unverifiable safety check must never let a query through; conversational and
    action_intent both default to their "nothing detected" value in that case too. Only
    SimpleRAGPipeline calls this, as the very first step, before any retrieval or generation work.

    conversational piggybacks on this same call (see build_safety_check_prompt) to flag small
    talk/greetings that carry no real information need — run_shared_tail's force_ungrounded uses
    it to skip the grounded/RAG-prompt path even if retrieval's similarity gate accidentally
    passes on vocabulary/style noise alone (same-language conversational text scores above the
    off-topic calibration floor regardless of topical relevance).

    action_intent piggybacks on the same call too — one of domain.actions.KNOWN_ACTIONS's keys, or
    None. A value outside that known set (a classifier hallucination) is treated as None, the same
    fail-safe posture as everything else here. backend_app uses this to decide whether to start
    collecting details for a registered action instead of answering as a normal query."""
    refusal_lang = resolve_answer_lang(detect_query_language(query))
    refusal = _REFUSAL_ANSWER_BY_LANG.get(refusal_lang, _REFUSAL_ANSWER_BY_LANG["uk"])
    if contains_opsec_risk_terms(query):
        queries_blocked_total.labels(layer="heuristic").inc()
        logger.warning("query_blocked", layer="heuristic")
        return False, refusal, False, None
    try:
        raw, _ = await generator.generate(
            build_safety_check_prompt(query),
            temperature=_SAFETY_CHECK_TEMPERATURE,
            max_tokens=_SAFETY_CHECK_MAX_TOKENS,
            timeout_s=_SAFETY_CHECK_TIMEOUT_S,
            json_mode=True,
        )
        parsed = json.loads(raw[raw.find("{") : raw.rfind("}") + 1])
        # Strict identity check, not bool(...): a malformed reply (a stray string "false", a
        # missing key, a non-boolean value) must resolve to unsafe, never be coerced to safe by
        # truthiness (e.g. bool("false") is True — a real footgun given the fail-closed policy).
        is_safe = parsed.get("safe") is True
        conversational = is_safe and parsed.get("conversational") is True
        raw_action_intent = parsed.get("action_intent")
        action_intent = (
            raw_action_intent if is_safe and raw_action_intent in KNOWN_ACTIONS else None
        )
    except Exception as exc:  # noqa: BLE001 — fail closed: an unverifiable safety check is unsafe
        logger.warning("query_safety_check_failed", err=type(exc).__name__)
        queries_blocked_total.labels(layer="llm_error").inc()
        return False, refusal, False, None
    if not is_safe:
        queries_blocked_total.labels(layer="llm").inc()
        logger.warning("query_blocked", layer="llm")
    return is_safe, refusal, conversational, action_intent


class RagContext(BaseModel):
    """Internal input to RAGPipeline.run() — not the HTTP request body (that's schemas.query)."""

    user_query: str
    district_slug: str | None
    route: QueryRoute


class RagResult(BaseModel):
    """Internal output of RAGPipeline.run(). `debug` carries fields the router needs for structured
    logging (top1_sim, band, n_chunks, llm_ok, llm_retries, grounded) without widening the
    pydantic schema for values that are never part of the HTTP contract. `grounded` is False for
    both an ungrounded-but-answered response and an OPSEC-blocked refusal — callers distinguish
    the latter via the separate `blocked` key, which only a blocked result sets."""

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
    answer_lang: str = "uk",
    force_ungrounded: bool = False,
) -> RagResult:
    """The ONE place the confidence-gate -> generate -> extractive-fallback tail lives (ADR-007).
    Both SimpleRAGPipeline and AgentRAGPipeline call this after producing their own
    (retrieved, top1_sim) — this is what makes the two branches converge on identical
    grounded/ungrounded/fallback behavior without duplicating it.

    `grounded` (retrieval produced usable context) decides which prompt gets built, but the LLM is
    ALWAYS called either way — an ungrounded query gets a real, conversational answer via
    build_general_prompt instead of a canned refusal. Confidence is 0.0 for any ungrounded answer,
    grounded or not: it signals "not verified city info", not "no answer was given".

    force_ungrounded=True (SimpleRAGPipeline passes check_query_safety's conversational flag)
    skips the grounded path even if top1_sim happens to clear sim_gate — a greeting can cross the
    numeric gate on same-language vocabulary/style noise alone, with no real topical match, and
    would otherwise get stuffed with irrelevant civic context instead of a natural reply."""
    retrieval_top1_sim.observe(top1_sim)
    band = confidence_band(top1_sim, sim_gate, sim_high)
    grounded = not force_ungrounded and bool(retrieved) and band is not ConfidenceBand.NO_INFO
    if not grounded:
        # Retrieval was insufficient to ground an answer - still an operationally interesting
        # signal (a KB coverage gap, or simply an off-topic/general query), even though the
        # pipeline no longer refuses outright because of it.
        retrieval_empty.inc()

    if grounded:
        top_results = assemble_context(retrieved, CONTEXT_TOKEN_BUDGET, count_tokens_fn)
        context_chunks = [r.text for r in top_results]
        prompt = build_rag_prompt(context_chunks, question, answer_lang)
    else:
        top_results = []
        prompt = build_general_prompt(question, answer_lang)

    route_label = route.value.lower()
    llm_ok = True
    retries = 0
    llm_start = time.perf_counter()
    try:
        answer, retries = await generator.generate(
            prompt, temperature=_GENERATION_TEMPERATURE, max_tokens=_MAX_OUTPUT_TOKENS,
            timeout_s=_GENERATE_TIMEOUT_S,
        )
        confidence = round(top1_sim, 2) if grounded else 0.0
        llm_calls.labels(route=route_label, outcome="ok").inc()
    except Exception as exc:  # noqa: BLE001 — LLM is the least reliable hop; demo must stay alive (ADR-007)
        llm_ok = False
        if top_results:
            answer = _FALLBACK_PREFIX + top_results[0].text
            confidence = min(round(top1_sim, 2), _FALLBACK_CONFIDENCE_CAP)
        else:
            # Double fallback: nothing grounded to extractively quote, and even the ungrounded
            # conversational attempt failed. Honest about the failure, not phrased as "no info".
            answer = _GENERATION_UNAVAILABLE_BY_LANG.get(
                answer_lang, _GENERATION_UNAVAILABLE_BY_LANG["uk"]
            )
            confidence = 0.0
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
            "grounded": grounded, "top1_sim": top1_sim, "band": band.value,
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
