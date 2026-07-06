"""
Purpose:   Flow (SimpleRAGPipeline, fake Embedder/Retriever/Generator). Every run starts with the
           OPSEC content-safety gate (check_query_safety): a safe query costs one leading Generator
           call before anything else; an unsafe one (heuristic match, LLM-classifier match, or the
           classifier itself failing — fail-closed) short-circuits with a refusal and never reaches
           retrieval or answer generation. Past the gate: retrieval decides `grounded`, but the
           Generator is called EITHER way — a sufficiently similar retrieval gets a grounded answer
           via build_rag_prompt; empty/insufficient retrieval gets a real, conversational answer via
           build_general_prompt instead of a canned refusal. A Generator error on the ANSWER call
           degrades to extractive fallback when grounded (the top chunk's text, prefixed), or an
           honest "couldn't respond" message when ungrounded (double fallback) — never a 5xx. Also
           the multilingual entrypoint: a non-Ukrainian query is translated to Ukrainian (one extra
           Generator call) and retrieval runs on the translation, while generation still receives
           the original query and the POLICY-RESOLVED answer language — never Russian, even for a
           Russian query (wartime policy). A Ukrainian query skips translation entirely. Exercises
           the pipeline directly (not RagService, which also owns rate-limiting/caching against a
           real repo — out of scope for this fast, DB-free flow).
Layer:     test
May import:   pytest, app.pipeline.simple, app.pipeline.base, tests.fakes.fake_generator,
              tests.fakes.fake_embedder, tests.fakes.fake_retriever, app.schemas/*
Must NOT import:  real openai, real asyncpg (injected fakes only)
"""
from __future__ import annotations

import json

from app.pipeline.base import RagContext
from app.pipeline.simple import SimpleRAGPipeline
from app.schemas.common import QueryRoute
from app.schemas.retrieval import RetrievalOutcome, RetrievalResult
from tests.fakes.fake_embedder import FakeEmbedder
from tests.fakes.fake_generator import FakeGenerator
from tests.fakes.fake_retriever import FakeRetriever

_SIM_GATE = 0.70
_SIM_HIGH = 0.80
_QUERY = "Коли вивезуть сміття?"

# The OPSEC safety check (pipeline.base.check_query_safety) is always the FIRST Generator call
# SimpleRAGPipeline.run() makes. Every test below that expects the pipeline to proceed past it
# scripts this as call #1.
_SAFE_JSON = json.dumps({"safe": True})


def _hit(chunk_id: int, similarity: float, text: str) -> RetrievalResult:
    return RetrievalResult(
        id=chunk_id, text=text, source="src", doc_type="instruction", district=None,
        similarity=similarity,
    )


def _pipeline(retriever: FakeRetriever, generator: FakeGenerator) -> SimpleRAGPipeline:
    return SimpleRAGPipeline(FakeEmbedder(), retriever, generator, _SIM_GATE, _SIM_HIGH)


def _ctx(query: str) -> RagContext:
    return RagContext(user_query=query, district_slug=None, route=QueryRoute.SIMPLE)


async def test_empty_retrieval_falls_back_to_ungrounded_conversational_answer() -> None:
    retriever = FakeRetriever({_QUERY: RetrievalOutcome(dense=[], fused=[])})
    ungrounded_answer = "Наразі не маю точних даних, але радо поспілкуюся!"
    generator = FakeGenerator(results=[(_SAFE_JSON, 0), (ungrounded_answer, 0)])
    pipeline = _pipeline(retriever, generator)

    result = await pipeline.run(_ctx(_QUERY))

    # Safety check + the ungrounded answer call — empty retrieval no longer skips generation, it
    # just changes which prompt (build_general_prompt, no <context>) gets used.
    assert generator.call_count == 2
    assert result.answer == ungrounded_answer
    assert result.confidence == 0.0
    assert result.sources_used == []
    assert result.debug["grounded"] is False


async def test_empty_retrieval_uses_the_general_conversation_prompt() -> None:
    """Distinct from the mechanism test above: confirms the SPECIFIC prompt sent for the answer
    call is build_general_prompt (no <context> block, permits ordinary conversation) rather than
    some other path, by asserting on text unique to that prompt's instruction."""
    retriever = FakeRetriever({_QUERY: RetrievalOutcome(dense=[], fused=[])})
    generator = FakeGenerator(results=[(_SAFE_JSON, 0), ("Привіт! Все добре, дякую.", 0)])
    pipeline = _pipeline(retriever, generator)

    await pipeline.run(_ctx(_QUERY))

    answer_prompt = generator.generate_calls[1]
    assert "<context>" not in answer_prompt
    assert "звичайне спілкування" in answer_prompt


async def test_ungrounded_generate_failure_falls_back_to_generation_unavailable_message() -> None:
    """Double fallback: retrieval didn't ground an answer AND the ungrounded conversational
    generate call itself failed. Falls back to an honest "couldn't respond" message — not the old
    "no info" wording, which would misrepresent a transient failure as a KB coverage gap."""
    retriever = FakeRetriever({_QUERY: RetrievalOutcome(dense=[], fused=[])})
    generator = FakeGenerator(results=[(_SAFE_JSON, 0), RuntimeError("boom")])
    pipeline = _pipeline(retriever, generator)

    result = await pipeline.run(_ctx(_QUERY))

    assert generator.call_count == 2
    assert result.answer == "Наразі не вдалося сформувати відповідь. Спробуйте, будь ласка, ще раз."
    assert result.confidence == 0.0
    assert result.debug["llm_ok"] is False
    assert result.debug["grounded"] is False


async def test_sufficient_retrieval_calls_generator_and_returns_its_answer() -> None:
    hit = _hit(1, similarity=0.9, text="Сміття вивозять щовівторка.")
    retriever = FakeRetriever({_QUERY: RetrievalOutcome(dense=[hit], fused=[hit])})
    generator = FakeGenerator(results=[(_SAFE_JSON, 0), ("Сміття вивозять щовівторка.", 0)])
    pipeline = _pipeline(retriever, generator)

    result = await pipeline.run(_ctx(_QUERY))

    assert generator.call_count == 2  # safety check + answer
    assert result.answer == "Сміття вивозять щовівторка."
    assert result.confidence == 0.9
    assert len(result.sources_used) == 1
    assert result.debug["grounded"] is True


async def test_generator_error_degrades_to_extractive_fallback() -> None:
    hit_text = "Сміття вивозять щовівторка."
    hit = _hit(1, similarity=0.9, text=hit_text)
    retriever = FakeRetriever({_QUERY: RetrievalOutcome(dense=[hit], fused=[hit])})
    # The safety check succeeds; the failure is scripted specifically onto the ANSWER call, so this
    # proves the fallback path, not an (unrelated) safety-check failure.
    generator = FakeGenerator(results=[(_SAFE_JSON, 0), RuntimeError("boom")])
    pipeline = _pipeline(retriever, generator)

    result = await pipeline.run(_ctx(_QUERY))

    assert generator.call_count == 2
    assert result.answer == f"За наявними даними: {hit_text}"
    assert result.confidence == 0.5
    assert result.debug["llm_ok"] is False


async def test_non_ukrainian_query_is_translated_before_retrieval() -> None:
    english_query = "how to apply for a utility subsidy"
    ukrainian_translation = "Як подати заяву на житлову субсидію?"
    hit = _hit(1, similarity=0.9, text="Субсидію оформлюють у ЦНАП.")
    # Retrieval is keyed by the UKRAINIAN text, so it only produces a hit if the pipeline searched
    # with the translation rather than the raw English query.
    retriever = FakeRetriever(
        {ukrainian_translation: RetrievalOutcome(dense=[hit], fused=[hit])}
    )
    # Call order: safety check, then combined detect+translate (bare JSON), then the answer.
    detect_json = json.dumps({"lang": "en", "uk": ukrainian_translation})
    generator = FakeGenerator(
        results=[
            (_SAFE_JSON, 0),
            (detect_json, 0),
            ("Apply for the subsidy at the service center.", 0),
        ]
    )
    pipeline = _pipeline(retriever, generator)

    result = await pipeline.run(_ctx(english_query))

    assert generator.call_count == 3  # safety check + detect/translate + answer
    assert retriever.calls[0][0] == ukrainian_translation  # searched with the translation
    assert result.debug["grounded"] is True
    # The generation prompt (3rd Generator call) carries the ORIGINAL query and the named English
    # answer-language directive, so the answer follows the user's language, not the context's.
    answer_prompt = generator.generate_calls[2]
    assert english_query in answer_prompt
    assert "English" in answer_prompt


async def test_non_ukrainian_ungrounded_answer_uses_localized_general_prompt() -> None:
    english_query = "what is the best pizza topping"
    retriever = FakeRetriever({})  # nothing matches -> empty outcome -> ungrounded path
    # Safety check, then detect+translate, then the ungrounded answer — empty retrieval no longer
    # skips generation, it just changes which prompt gets used.
    generator = FakeGenerator(
        results=[
            (_SAFE_JSON, 0),
            (json.dumps({"lang": "en", "uk": "..."}), 0),
            ("Pepperoni is a classic choice!", 0),
        ]
    )
    pipeline = _pipeline(retriever, generator)

    result = await pipeline.run(_ctx(english_query))

    assert generator.call_count == 3  # safety check + detect + the ungrounded answer
    assert result.debug["grounded"] is False
    assert result.answer == "Pepperoni is a classic choice!"
    # The general-conversation prompt (3rd Generator call) carries the named English directive,
    # matching the grounded path's same localization guarantee.
    answer_prompt = generator.generate_calls[2]
    assert "English" in answer_prompt


async def test_ukrainian_query_skips_translation() -> None:
    hit = _hit(1, similarity=0.9, text="Сміття вивозять щовівторка.")
    retriever = FakeRetriever({_QUERY: RetrievalOutcome(dense=[hit], fused=[hit])})
    generator = FakeGenerator(results=[(_SAFE_JSON, 0), ("Сміття вивозять щовівторка.", 0)])
    pipeline = _pipeline(retriever, generator)

    await pipeline.run(_ctx(_QUERY))

    # No translation call: the query already carries a Ukrainian-only letter, so retrieval used it
    # verbatim and the only calls were the safety check and the answer.
    assert generator.call_count == 2
    assert retriever.calls[0][0] == _QUERY


async def test_russian_query_answer_prompt_carries_ukrainian_directive_never_russian() -> None:
    """Wartime policy locked in at the full pipeline level, not just the prompt-builder unit level
    (see tests/unit/test_prompts.py for that one): a Russian-language query must never produce a
    generation prompt carrying a Russian-language directive. detect_and_translate's answer_lang is
    always policy-resolved through domain.language.resolve_answer_lang before it reaches
    build_rag_prompt, so "ru" in, "uk" (never "ru") out."""
    russian_query = "Как оформить субсидию на коммунальные услуги?"
    ukrainian_translation = "Як оформити субсидію на комунальні послуги?"
    hit = _hit(1, similarity=0.9, text="Субсидію оформлюють у ЦНАП.")
    retriever = FakeRetriever(
        {ukrainian_translation: RetrievalOutcome(dense=[hit], fused=[hit])}
    )
    detect_json = json.dumps({"lang": "ru", "uk": ukrainian_translation})
    generator = FakeGenerator(
        results=[(_SAFE_JSON, 0), (detect_json, 0), ("Субсидію оформлюють у ЦНАП.", 0)]
    )
    pipeline = _pipeline(retriever, generator)

    result = await pipeline.run(_ctx(russian_query))

    assert generator.call_count == 3
    answer_prompt = generator.generate_calls[2]
    assert "УКРАЇНСЬКОЮ" in answer_prompt
    assert "РОСІЙСЬКОЮ" not in answer_prompt
    assert result.debug["grounded"] is True


# ---------------------------------------------------------------------------
# OPSEC content-safety gate — layer 1 (keyword heuristic), layer 2 (LLM classifier), fail-closed
# ---------------------------------------------------------------------------

async def test_heuristic_blocked_query_never_calls_generator() -> None:
    """Layer 1 (domain.opsec.contains_opsec_risk_terms) is a pure keyword check — a query it flags
    is refused before the Generator is invoked at all, not even for the safety check itself."""
    retriever = FakeRetriever({})
    generator = FakeGenerator()
    pipeline = _pipeline(retriever, generator)
    query = "Які координати блокпоста на в'їзді в місто?"

    result = await pipeline.run(_ctx(query))

    assert generator.call_count == 0
    assert result.debug["blocked"] is True
    assert result.confidence == 0.0
    assert result.sources_used == []


async def test_llm_classifier_blocks_a_query_the_heuristic_missed() -> None:
    """Layer 2: a query with none of the fixed risk phrases (heuristic passes) but that the LLM
    classifier itself flags as unsafe is still refused — neither retrieval nor answer generation
    ever run."""
    retriever = FakeRetriever({_QUERY: RetrievalOutcome(dense=[], fused=[])})
    generator = FakeGenerator(result=(json.dumps({"safe": False}), 0))
    pipeline = _pipeline(retriever, generator)

    result = await pipeline.run(_ctx(_QUERY))

    assert generator.call_count == 1  # the safety check only
    assert result.debug["blocked"] is True


async def test_safety_classifier_error_fails_closed() -> None:
    """Fail-closed policy: if the LLM classifier call itself raises (timeout, network error), the
    query is refused, never let through — an unverifiable safety check is treated as unsafe."""
    retriever = FakeRetriever({_QUERY: RetrievalOutcome(dense=[], fused=[])})
    generator = FakeGenerator(error=TimeoutError("classifier timed out"))
    pipeline = _pipeline(retriever, generator)

    result = await pipeline.run(_ctx(_QUERY))

    assert result.debug["blocked"] is True
    assert generator.call_count == 1


async def test_safety_classifier_malformed_reply_fails_closed() -> None:
    """Same fail-closed policy, different failure mode: a reply that parses to something other
    than the literal JSON boolean true also resolves to unsafe (check_query_safety's `parsed.get
    ("safe") is True` is a strict identity check, not a truthiness cast)."""
    retriever = FakeRetriever({_QUERY: RetrievalOutcome(dense=[], fused=[])})
    generator = FakeGenerator(result=("not json at all", 0))
    pipeline = _pipeline(retriever, generator)

    result = await pipeline.run(_ctx(_QUERY))

    assert result.debug["blocked"] is True
