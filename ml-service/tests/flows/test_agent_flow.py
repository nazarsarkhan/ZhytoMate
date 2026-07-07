"""
Purpose:   Flow (AgentRAGPipeline, fake Embedder/Retriever/Generator): a multi-intent query
           decomposes into sub-queries that retrieve in parallel and merge into one synthesis call;
           when 2+ sub-queries are dry (below sim_gate), only the FIRST one (by list order) is
           rewritten and re-retried — a single shared re-query budget for the whole request, not one
           per dry sub-query. Also proves the shared tail holds through the agent path: all-empty
           retrieval => the synthesis Generator call still happens, answering ungrounded via
           build_general_prompt instead of a canned refusal; a Generator error at synthesis =>
           the same extractive (or, if ungrounded, double) fallback as the simple path. Also
           covers the two Phase-4
           review fixes: per-sub-query fused lists are rank-interleaved before assemble_context
           runs, so a globally relevant single-chunk sub-query isn't starved out of the token budget
           by a multi-chunk sub-query that merely arrived first in decomposition order; and a
           sub-query whose retrieve() raises degrades to a dry outcome instead of aborting the whole
           request. AGENT_RAG_ENABLED gating/fallback-to-simple is RagService's job, not
           AgentRAGPipeline's — exercised here directly, not through the router.
Layer:     test
May import:   pytest, app.pipeline.agent, app.pipeline.base, app.domain.context,
              tests.fakes.fake_generator, tests.fakes.fake_embedder, tests.fakes.fake_retriever,
              app.schemas/*, stdlib (json)
Must NOT import:  real openai; live network
"""
from __future__ import annotations

import json

from app.domain.context import CONTEXT_TOKEN_BUDGET
from app.pipeline.agent import AgentRAGPipeline
from app.pipeline.base import RagContext
from app.schemas.common import QueryRoute
from app.schemas.retrieval import RetrievalOutcome, RetrievalResult
from tests.fakes.fake_embedder import FakeEmbedder
from tests.fakes.fake_generator import FakeGenerator
from tests.fakes.fake_retriever import FakeRetriever

_SIM_GATE = 0.70
_SIM_HIGH = 0.80

_TRASH_Q = "Коли вивезуть сміття?"
_LIGHT_Q = "Коли ввімкнуть світло?"
_WATER_Q = "Коли буде вода?"
_LIGHT_REWRITTEN = "Який графік відключень світла?"

_MULTI_QUERY = f"{_TRASH_Q} {_LIGHT_Q} {_WATER_Q}"

# Sized so any 2 of these chunks fit inside the shared-tail's real token budget but any 3 don't —
# lets the interleaving test prove, with FakeEmbedder's word-count tokenizer, exactly which chunks
# survive assemble_context's greedy trim under a given merge order.
_CHUNK_TOKENS = CONTEXT_TOKEN_BUDGET // 3 + 100


def _hit(
    chunk_id: int, similarity: float, text: str = "текст", source: str = "src"
) -> RetrievalResult:
    return RetrievalResult(
        id=chunk_id, text=text, source=source, doc_type="instruction", district=None,
        similarity=similarity,
    )


def _sized_hit(chunk_id: int, similarity: float, source: str) -> RetrievalResult:
    """A chunk whose text is exactly _CHUNK_TOKENS words long, so its cost against
    CONTEXT_TOKEN_BUDGET is precise and deterministic under FakeEmbedder's word-count tokenizer."""
    return _hit(chunk_id, similarity, text=" ".join(["w"] * _CHUNK_TOKENS), source=source)


def _outcome(*hits: RetrievalResult) -> RetrievalOutcome:
    return RetrievalOutcome(dense=list(hits), fused=list(hits))


def _pipeline(
    retriever: FakeRetriever, generator: FakeGenerator, max_subqueries: int = 3
) -> AgentRAGPipeline:
    return AgentRAGPipeline(
        FakeEmbedder(), retriever, generator, _SIM_GATE, _SIM_HIGH, max_subqueries
    )


async def test_all_subqueries_sufficient_synthesizes_without_any_rewrite() -> None:
    decompose_json = json.dumps([_TRASH_Q, _LIGHT_Q])
    retriever = FakeRetriever(
        {
            _TRASH_Q: _outcome(_hit(1, 0.9, "Сміття вивозять щовівторка.")),
            _LIGHT_Q: _outcome(_hit(2, 0.85, "Світло за графіком.")),
        }
    )
    generator = FakeGenerator(results=[(decompose_json, 0), ("Зведена відповідь.", 0)])
    pipeline = _pipeline(retriever, generator)

    result = await pipeline.run(
        RagContext(user_query=_MULTI_QUERY, district_slug=None, route=QueryRoute.COMPLEX)
    )

    assert generator.call_count == 2  # decompose + synthesis — no rewrite needed
    assert result.answer == "Зведена відповідь."
    call_texts = [c[0] for c in retriever.calls]
    assert call_texts.count(_TRASH_Q) == 1
    assert call_texts.count(_LIGHT_Q) == 1


async def test_only_the_first_dry_subquery_is_rewritten_and_reretried() -> None:
    decompose_json = json.dumps([_TRASH_Q, _LIGHT_Q, _WATER_Q])
    retriever = FakeRetriever(
        {
            _TRASH_Q: _outcome(_hit(1, 0.9, "Сміття вивозять щовівторка.")),
            _LIGHT_Q: _outcome(_hit(2, 0.2, "нерелевантно")),      # dry — first dry, by list order
            _WATER_Q: _outcome(_hit(3, 0.1, "теж нерелевантно")),  # dry — second dry, must stay dry
            _LIGHT_REWRITTEN: _outcome(_hit(4, 0.95, "Графік відключень: 10:00-14:00.")),
        }
    )
    generator = FakeGenerator(
        results=[(decompose_json, 0), (_LIGHT_REWRITTEN, 0), ("Зведена відповідь.", 0)]
    )
    pipeline = _pipeline(retriever, generator)

    result = await pipeline.run(
        RagContext(user_query=_MULTI_QUERY, district_slug=None, route=QueryRoute.COMPLEX)
    )

    # decompose (1) + exactly ONE rewrite (1) + synthesis (1) — never one rewrite per dry sub-query.
    assert generator.call_count == 3
    call_texts = [c[0] for c in retriever.calls]
    assert call_texts.count(_TRASH_Q) == 1
    # the initial (dry) retrieve for the rewritten one
    assert call_texts.count(_LIGHT_Q) == 1
    assert call_texts.count(_WATER_Q) == 1           # still only retrieved once — never rewritten
    # the single shared re-query budget was spent here
    assert call_texts.count(_LIGHT_REWRITTEN) == 1
    assert len(retriever.calls) == 4
    assert result.answer == "Зведена відповідь."
    assert result.confidence == 0.95  # max dense top-1 across sub-queries (rewritten світло wins)


async def test_all_subqueries_dry_falls_back_to_ungrounded_synthesis_answer() -> None:
    decompose_json = json.dumps([_TRASH_Q])
    retriever = FakeRetriever({})  # every query_text is un-scripted -> empty outcome
    ungrounded_answer = "Наразі не маю точних даних, але радо поспілкуюся!"
    generator = FakeGenerator(
        results=[(decompose_json, 0), ("рерайт", 0), (ungrounded_answer, 0)]
    )
    pipeline = _pipeline(retriever, generator)

    result = await pipeline.run(
        RagContext(user_query=_TRASH_Q, district_slug=None, route=QueryRoute.SIMPLE)
    )

    # decompose + the single shared rewrite attempt + the synthesis call all happen — the shared
    # tail's ungrounded path answers via build_general_prompt instead of skipping synthesis.
    assert generator.call_count == 3
    assert result.answer == ungrounded_answer
    assert result.debug["grounded"] is False
    assert result.sources_used == []


async def test_synthesis_generator_error_degrades_to_extractive_fallback() -> None:
    decompose_json = json.dumps([_TRASH_Q])
    hit_text = "Сміття вивозять щовівторка."
    retriever = FakeRetriever({_TRASH_Q: _outcome(_hit(1, 0.9, hit_text))})
    generator = FakeGenerator(results=[(decompose_json, 0)], error=RuntimeError("boom"))
    pipeline = _pipeline(retriever, generator)

    result = await pipeline.run(
        RagContext(user_query=_TRASH_Q, district_slug=None, route=QueryRoute.SIMPLE)
    )

    assert generator.call_count == 2  # decompose succeeds, synthesis raises
    assert result.answer == f"За наявними даними: {hit_text}"
    assert result.confidence == 0.5
    assert result.debug["llm_ok"] is False


async def test_interleaving_prevents_one_subquery_from_starving_another_out_of_the_budget() -> None:
    """Sub-query A alone returns 3 locally top-ranked chunks whose combined size exceeds
    CONTEXT_TOKEN_BUDGET; sub-query B returns a single, globally very relevant chunk. Under the old
    block-concatenation merge (A's whole fused list before B's), A's chunks would consume the entire
    budget and B's chunk would never be seen. Under rank interleaving, B's rank-0 chunk is offered
    before A's rank-1/rank-2 chunks, so it survives assemble_context's trim."""
    query_a, query_b = "Query A", "Query B"
    decompose_json = json.dumps([query_a, query_b])
    retriever = FakeRetriever(
        {
            query_a: _outcome(
                _sized_hit(1, 0.95, "A0"), _sized_hit(2, 0.90, "A1"), _sized_hit(3, 0.85, "A2")
            ),
            query_b: _outcome(_sized_hit(4, 0.99, "B0")),
        }
    )
    generator = FakeGenerator(results=[(decompose_json, 0), ("Зведена відповідь.", 0)])
    pipeline = _pipeline(retriever, generator)

    result = await pipeline.run(
        RagContext(user_query=f"{query_a} {query_b}", district_slug=None, route=QueryRoute.COMPLEX)
    )

    sources = [s.source for s in result.sources_used]
    assert sources == ["A0", "B0"]  # B0 (B's rank 0) beats out A2 (A's rank 2) for the last slot
    assert result.debug["n_chunks"] == 2
    assert result.confidence == 0.99  # top1 across sub-queries is B0's — never dropped upstream


async def test_agent_grounds_a_dry_subquery_via_strong_lexical_match_after_reretry() -> None:
    """Same lexical-override mechanism as SimpleRAGPipeline (see test_rag_flow.py's CNAP-style
    test), proven through AgentRAGPipeline's own call to run_shared_tail: a single sub-query whose
    dense top1_sim sits below sim_gate is dry (triggers the one shared re-query), and the
    rewritten retry is STILL low-dense-similarity — but both the original and the rewritten
    outcome's fused top-1 chunk agree with their own lexical top-1, so the final synthesized
    answer must still ground, not fall back to the ungrounded/general-conversation path."""
    cnap_q = "Де ЦНАП?"
    cnap_rewritten = "Яка адреса Центру надання адміністративних послуг?"
    decompose_json = json.dumps([cnap_q])
    cnap_text = "ЦНАП Житомирської міської ради: вул. Ватутіна, 2/1."
    original_hit = _hit(1, 0.35, cnap_text)
    rewritten_hit = _hit(2, 0.38, cnap_text)
    retriever = FakeRetriever(
        {
            cnap_q: RetrievalOutcome(
                dense=[original_hit], fused=[original_hit], lexical=[original_hit]
            ),
            cnap_rewritten: RetrievalOutcome(
                dense=[rewritten_hit], fused=[rewritten_hit], lexical=[rewritten_hit]
            ),
        }
    )
    generator = FakeGenerator(
        results=[
            (decompose_json, 0),
            (cnap_rewritten, 0),
            ("ЦНАП знаходиться на вул. Ватутіна, 2/1.", 0),
        ]
    )
    pipeline = _pipeline(retriever, generator)

    result = await pipeline.run(
        RagContext(user_query=cnap_q, district_slug=None, route=QueryRoute.SIMPLE)
    )

    assert generator.call_count == 3  # decompose + the one shared re-query + synthesis
    assert result.debug["grounded"] is True
    assert result.answer == "ЦНАП знаходиться на вул. Ватутіна, 2/1."


async def test_one_subquery_retrieval_failure_is_isolated_and_treated_as_dry() -> None:
    """A transient error inside one sub-query's retrieve() (e.g. a dropped Postgres connection) must
    not blow up the whole agent request. It degrades to an empty (dry) outcome, so the existing
    single shared re-query budget picks it up exactly like any other dry sub-query, while the other,
    unaffected sub-query's result still reaches the synthesis prompt."""
    query_a, query_b = "Query A", "Query B"
    rewritten_b = "Query B, уточнено"
    decompose_json = json.dumps([query_a, query_b])
    retriever = FakeRetriever(
        {
            query_a: _outcome(_hit(1, 0.95, "Дані по A.")),
            query_b: RuntimeError("connection reset by peer"),
            rewritten_b: _outcome(_hit(2, 0.90, "Дані по B після рерайту.")),
        }
    )
    generator = FakeGenerator(
        results=[(decompose_json, 0), (rewritten_b, 0), ("Зведена відповідь.", 0)]
    )
    pipeline = _pipeline(retriever, generator)

    result = await pipeline.run(
        RagContext(user_query=f"{query_a} {query_b}", district_slug=None, route=QueryRoute.COMPLEX)
    )

    # (a) the request completes and produces the synthesized answer rather than raising/500ing.
    assert result.answer == "Зведена відповідь."
    assert result.debug["grounded"] is True

    # (b) sub-query A's result was unaffected by B's failure, and B's recovered (post-rewrite)
    # result reached the final context too — the failure of the first attempt didn't drop it.
    similarities = sorted(s.similarity for s in result.sources_used)
    assert similarities == [0.90, 0.95]

    # (c) the failed sub-query was treated as dry: it got the one shared re-query, and it recovered.
    call_texts = [c[0] for c in retriever.calls]
    assert call_texts.count(query_a) == 1
    assert call_texts.count(query_b) == 1
    assert call_texts.count(rewritten_b) == 1
    assert generator.call_count == 3  # decompose + exactly one rewrite + synthesis
