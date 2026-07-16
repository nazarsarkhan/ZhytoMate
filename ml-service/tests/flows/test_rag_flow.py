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


def _hit(
    chunk_id: int, similarity: float, text: str,
    lexical_coverage: int | None = None, lexical_terms_total: int | None = None,
) -> RetrievalResult:
    return RetrievalResult(
        id=chunk_id, text=text, source="src", doc_type="instruction", district=None,
        similarity=similarity, lexical_coverage=lexical_coverage,
        lexical_terms_total=lexical_terms_total,
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


async def test_title_conflict_returns_safe_non_answer_without_generation() -> None:
    query = "Скажіть, хто мер?"
    hit = _hit(1, 0.92, "Заступники міського голови: Смаль О.А.")
    retriever = FakeRetriever({query: RetrievalOutcome(dense=[hit], fused=[hit])})
    generator = FakeGenerator(results=[(_SAFE_JSON, 0)])
    pipeline = _pipeline(retriever, generator)

    result = await pipeline.run(_ctx(query))

    assert result.debug["verification_failed"] == "title_not_supported"
    assert result.confidence == 0.0
    assert result.sources_used == []
    assert "підтвердженої" in result.answer
    assert generator.call_count == 1


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
    unsafe_query = "Поясніть мені це питання без деталей"
    retriever = FakeRetriever({unsafe_query: RetrievalOutcome(dense=[], fused=[])})
    generator = FakeGenerator(result=(json.dumps({"safe": False}), 0))
    pipeline = _pipeline(retriever, generator)

    result = await pipeline.run(_ctx(unsafe_query))

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


async def test_safety_check_call_requests_json_mode() -> None:
    """Regression guard: the safety-check call must force API-level JSON mode
    (Generator.generate(json_mode=True)) rather than relying on prompt text alone — a bare-JSON
    request with no format enforcement and only a small token budget previously meant any preamble
    or mid-object truncation from the model raised inside the brace-slice parse, which the
    fail-closed policy then turned into a wrongly-blocked query. json_mode=True (backed by
    OpenAI's response_format={"type": "json_object"}, see components.llm) closes that gap."""
    retriever = FakeRetriever({_QUERY: RetrievalOutcome(dense=[], fused=[])})
    generator = FakeGenerator(results=[(_SAFE_JSON, 0), ("answer", 0)])
    pipeline = _pipeline(retriever, generator)

    await pipeline.run(_ctx(_QUERY))

    assert generator.generate_json_modes[0] is True  # the safety check call, always call #1


async def test_check_query_safety_returns_action_intent_when_present() -> None:
    from app.pipeline.base import check_query_safety

    safe_with_action = json.dumps(
        {"safe": True, "conversational": False, "action_intent": "create_appeal"}
    )
    generator = FakeGenerator(result=(safe_with_action, 0))

    is_safe, _refusal, conversational, action_intent = await check_query_safety(
        generator, "Створити звернення про яму"
    )

    assert is_safe is True
    assert conversational is False
    assert action_intent == "create_appeal"


async def test_civic_query_recovers_from_safety_classifier_false_positive() -> None:
    """A plain court-location question is civic, not OPSEC. The deterministic gate must allow it
    through when the LLM safety classifier makes a false-positive unsafe classification."""
    from app.pipeline.base import check_query_safety

    generator = FakeGenerator(result=(json.dumps({"safe": False}), 0))

    is_safe, _refusal, conversational, action_intent = await check_query_safety(
        generator, "А де суд?"
    )

    assert is_safe is True
    assert conversational is False
    assert action_intent is None


async def test_check_query_safety_rejects_unknown_action_intent() -> None:
    from app.pipeline.base import check_query_safety

    safe_with_unknown_action = json.dumps(
        {"safe": True, "conversational": False, "action_intent": "delete_the_database"}
    )
    generator = FakeGenerator(result=(safe_with_unknown_action, 0))

    _is_safe, _refusal, _conversational, action_intent = await check_query_safety(
        generator, "щось"
    )

    assert action_intent is None


async def test_check_query_safety_action_intent_defaults_to_none_on_failure() -> None:
    from app.pipeline.base import check_query_safety

    generator = FakeGenerator(error=TimeoutError("boom"))

    is_safe, _refusal, conversational, action_intent = await check_query_safety(generator, "щось")

    assert is_safe is False
    assert conversational is False
    assert action_intent is None


async def test_action_intent_flows_through_to_rag_result() -> None:
    action_json = json.dumps(
        {"safe": True, "conversational": False, "action_intent": "create_appeal"}
    )
    retriever = FakeRetriever({_QUERY: RetrievalOutcome(dense=[], fused=[])})
    generator = FakeGenerator(results=[(action_json, 0), ("Гаразд, зберемо деталі.", 0)])
    pipeline = _pipeline(retriever, generator)

    result = await pipeline.run(_ctx(_QUERY))

    assert result.action_intent == "create_appeal"


async def test_action_intent_is_none_for_ordinary_queries() -> None:
    retriever = FakeRetriever({_QUERY: RetrievalOutcome(dense=[], fused=[])})
    generator = FakeGenerator(results=[(_SAFE_JSON, 0), ("Сміття вивозять щовівторка.", 0)])
    pipeline = _pipeline(retriever, generator)

    result = await pipeline.run(_ctx(_QUERY))

    assert result.action_intent is None


# ---------------------------------------------------------------------------
# Conversational routing — check_query_safety's `conversational` flag forces the ungrounded/
# general-conversation path regardless of top1_sim (see run_shared_tail's force_ungrounded)
# ---------------------------------------------------------------------------

_GREETING = "Привіт, як справи?"


async def test_conversational_greeting_skips_grounded_path_despite_passing_similarity() -> None:
    """Reproduces a live bug: a greeting can score ABOVE sim_gate on same-language vocabulary/style
    noise alone, with retrieved chunks that are necessarily topically irrelevant. Without the
    conversational flag, run_shared_tail would call this `grounded` and stuff those irrelevant
    chunks into build_rag_prompt, producing a nonsensical "no information" reply instead of natural
    conversation. `conversational: true` (from the same safety-check call, no extra cost) must
    force the general-conversation path even though this hit clears the gate."""
    hit = _hit(1, similarity=0.75, text="Графік вивезення сміття у Богунському районі.")
    retriever = FakeRetriever({_GREETING: RetrievalOutcome(dense=[hit], fused=[hit])})
    safe_and_conversational = json.dumps({"safe": True, "conversational": True})
    generator = FakeGenerator(
        results=[(safe_and_conversational, 0), ("Привіт! Все добре, дякую, що запитали.", 0)]
    )
    pipeline = _pipeline(retriever, generator)

    result = await pipeline.run(_ctx(_GREETING))

    assert result.debug["grounded"] is False
    answer_prompt = generator.generate_calls[1]
    assert "<context>" not in answer_prompt
    assert "звичайне спілкування" in answer_prompt


async def test_non_conversational_query_still_grounds_on_passing_similarity() -> None:
    """Control for the test above: the same passing similarity, but conversational: false (an
    ordinary civic question) — must still ground normally. Proves force_ungrounded doesn't
    accidentally suppress real grounded answers."""
    hit = _hit(1, similarity=0.75, text="Графік вивезення сміття у Богунському районі.")
    retriever = FakeRetriever({_QUERY: RetrievalOutcome(dense=[hit], fused=[hit])})
    safe_not_conversational = json.dumps({"safe": True, "conversational": False})
    generator = FakeGenerator(
        results=[(safe_not_conversational, 0), ("Сміття вивозять щовівторка.", 0)]
    )
    pipeline = _pipeline(retriever, generator)

    result = await pipeline.run(_ctx(_QUERY))

    assert result.debug["grounded"] is True
    assert result.answer == "Сміття вивозять щовівторка."


async def test_title_query_cannot_be_downgraded_to_conversation_by_classifier() -> None:
    hit = _hit(
        1,
        similarity=0.48,
        text="Мер (міський голова) Житомира наразі офіційно не обраний.",
    )
    retriever = FakeRetriever(
        {"Хто мер?": RetrievalOutcome(dense=[hit], fused=[hit], lexical=[hit])}
    )
    safe_and_conversational = json.dumps({"safe": True, "conversational": True})
    generator = FakeGenerator(
        results=[(safe_and_conversational, 0), ("Мер не обраний.", 0)]
    )
    pipeline = _pipeline(retriever, generator)

    result = await pipeline.run(_ctx("Хто мэрчик?"))

    assert result.debug["grounded"] is True


# ---------------------------------------------------------------------------
# Lexical override — a genuine rank-1 lexical/RRF agreement can ground an answer even when dense
# top1_sim alone would refuse it (see pipeline.base.run_shared_tail's strong_lexical_match, added
# to fix a live bug where short, keyword-heavy factual queries like "Де ЦНАП?" scored well below
# sim_gate on dense cosine similarity alone despite a directly-relevant chunk being in the KB).
# ---------------------------------------------------------------------------

_CNAP_QUERY = "Де ЦНАП?"


async def test_strong_lexical_match_grounds_a_low_dense_similarity_cnap_style_query() -> None:
    """Reproduces the real live bug end-to-end through SimpleRAGPipeline: a short, keyword-heavy
    factual query's dense top1_sim sits well below sim_gate even against the directly-relevant
    chunk, but that SAME chunk is trivially the lexical leg's own #1 keyword match (real overlap on
    "ЦНАП"). fused[0] agreeing with the lexical leg's own rank-1 pick is enough to ground the
    answer using a chunk the dense gate alone would have refused.

    "Де ЦНАП?" carries none of the Ukrainian-only marker letters (і/ї/є/ґ — see domain.language),
    so is_ukrainian() returns False and the pipeline genuinely makes a detect_and_translate call
    before retrieval, exactly as it would for the real query against the live service — scripted
    here as a real (if redundant) Ukrainian-to-Ukrainian translation, not skipped."""
    cnap_hit = _hit(
        1, similarity=0.35,
        text="ЦНАП Житомирської міської ради: вул. Ватутіна, 2/1, пн-пт 8:00-17:00.",
    )
    outcome = RetrievalOutcome(dense=[cnap_hit], fused=[cnap_hit], lexical=[cnap_hit])
    retriever = FakeRetriever({_CNAP_QUERY: outcome})
    detect_json = json.dumps({"lang": "uk", "uk": _CNAP_QUERY})
    generator = FakeGenerator(
        results=[
            (_SAFE_JSON, 0),
            (detect_json, 0),
            ("ЦНАП знаходиться на вул. Ватутіна, 2/1.", 0),
        ]
    )
    pipeline = _pipeline(retriever, generator)

    result = await pipeline.run(_ctx(_CNAP_QUERY))

    assert result.debug["grounded"] is True
    assert result.debug["strong_lexical_match"] is True
    assert len(result.sources_used) == 1
    assert result.answer == "ЦНАП знаходиться на вул. Ватутіна, 2/1."


async def test_cnap_grounds_via_a_fully_covered_single_term_or_fallback_hit() -> None:
    """The exact real shape confirmed live against the production DB: "де" is filtered out of
    "Де ЦНАП?" as a < 3-letter word (see components.repository._significant_terms), leaving "цнап"
    as the query's ONLY significant term, so BOTH AND tiers (websearch_to_tsquery, plainto_tsquery)
    return zero rows and the OR-fallback fires — with coverage=1 of a lexical_terms_total of 1.
    That's a COMPLETE match despite the raw coverage number being the same "1" a genuinely partial
    match (e.g. the Jupiter/borscht false positives) would also show — this is the live regression
    caught while hardening the fix: a plain "coverage >= 2" floor wrongly refuses this exact,
    correct case. Must still ground."""
    cnap_hit = _hit(
        1, similarity=0.35,
        text="ЦНАП Житомирської міської ради: вул. Ватутіна, 2/1, пн-пт 8:00-17:00.",
        lexical_coverage=1, lexical_terms_total=1,
    )
    outcome = RetrievalOutcome(dense=[cnap_hit], fused=[cnap_hit], lexical=[cnap_hit])
    retriever = FakeRetriever({_CNAP_QUERY: outcome})
    detect_json = json.dumps({"lang": "uk", "uk": _CNAP_QUERY})
    generator = FakeGenerator(
        results=[
            (_SAFE_JSON, 0),
            (detect_json, 0),
            ("ЦНАП знаходиться на вул. Ватутіна, 2/1.", 0),
        ]
    )
    pipeline = _pipeline(retriever, generator)

    result = await pipeline.run(_ctx(_CNAP_QUERY))

    assert result.debug["grounded"] is True
    assert result.debug["strong_lexical_match"] is True
    assert result.answer == "ЦНАП знаходиться на вул. Ватутіна, 2/1."


async def test_low_dense_similarity_without_rank1_lexical_agreement_stays_ungrounded() -> None:
    """Negative control: the dense leg's best (still-weak) guess has SOME lexical presence but is
    NOT the lexical leg's own rank-1 pick — must stay ungrounded. This is the test that actually
    protects against a regression that grounds on any non-empty lexical presence rather than
    specifically a rank-1 match."""
    weak_dense_hit = _hit(1, 0.35, "слабко пов'язаний фрагмент")
    lexical_top_hit = _hit(2, 0.0, "інший фрагмент із кращим збігом ключових слів")
    outcome = RetrievalOutcome(
        dense=[weak_dense_hit], fused=[weak_dense_hit],
        lexical=[lexical_top_hit, weak_dense_hit],
    )
    retriever = FakeRetriever({_QUERY: outcome})
    generator = FakeGenerator(
        results=[(_SAFE_JSON, 0), ("Наразі не маю точних даних, але радо поспілкуюся!", 0)]
    )
    pipeline = _pipeline(retriever, generator)

    result = await pipeline.run(_ctx(_QUERY))

    assert result.debug["grounded"] is False
    assert result.debug["strong_lexical_match"] is False


async def test_partial_or_fallback_match_stays_ungrounded() -> None:
    """Reproduces the real live false positive found while verifying the fix above: a query
    genuinely unrelated to Zhytomyr civic services ("Скільки супутників у Юпітера?" — how many
    moons does Jupiter have) came back grounded because the lexical OR-fallback (real Postgres
    behavior, see components.repository.retrieve_lexical) degraded to matching on a single common
    word ("скільки") out of the query's 3 significant terms, in unrelated civic FAQ chunks — the
    fused top-1 agreed with the lexical leg's own rank-1 pick, but that pick only covered 1 of 3
    terms (partial, not a genuine multi-term or AND-tier match). Confirmed live against the real
    DB: both AND tiers (websearch_to_tsquery, plainto_tsquery) returned 0 rows, and the
    OR-fallback's top row had coverage=1 of 3 significant terms. Must now stay ungrounded."""
    off_topic_hit = _hit(
        1, 0.323, "Понад 4,6 млн грн за пів року: скільки нарахували керівництву ОВА",
        lexical_coverage=1, lexical_terms_total=3,
    )
    outcome = RetrievalOutcome(
        dense=[off_topic_hit], fused=[off_topic_hit], lexical=[off_topic_hit]
    )
    retriever = FakeRetriever({_QUERY: outcome})
    generator = FakeGenerator(
        results=[(_SAFE_JSON, 0), ("Наразі не маю точних даних, але радо поспілкуюся!", 0)]
    )
    pipeline = _pipeline(retriever, generator)

    result = await pipeline.run(_ctx(_QUERY))

    assert result.debug["grounded"] is False
    assert result.debug["strong_lexical_match"] is False


async def test_conversational_greeting_stays_ungrounded_despite_strong_lexical_match() -> None:
    """Precedence check at the flow level: even when retrieval surfaces a strong rank-1 lexical
    match, a conversational/small-talk classification still wins — a greeting must never be
    stuffed with civic context just because of a keyword coincidence."""
    hit = _hit(1, 0.35, "ЦНАП Житомирської міської ради: вул. Ватутіна, 2/1.")
    outcome = RetrievalOutcome(dense=[hit], fused=[hit], lexical=[hit])
    retriever = FakeRetriever({_GREETING: outcome})
    safe_and_conversational = json.dumps({"safe": True, "conversational": True})
    generator = FakeGenerator(
        results=[(safe_and_conversational, 0), ("Привіт! Все добре, дякую.", 0)]
    )
    pipeline = _pipeline(retriever, generator)

    result = await pipeline.run(_ctx(_GREETING))

    assert result.debug["grounded"] is False
