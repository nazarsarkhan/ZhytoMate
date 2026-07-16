"""
Purpose:   Unit: HybridRetriever's retrieval_leg_hits{leg} counter increments by the real hit count
           each leg contributed (dense/lexical), not a flat call counter — including the zero-hit
           case for an empty leg. Mirrors test_embedder.py's before/after counter-snapshot pattern
           (Prometheus counters are process-global, so a snapshot-and-delta assertion avoids
           cross-test contamination). Also covers RetrievalOutcome.lexical_top1_id (the property
           run_shared_tail's strong_lexical_match check reads), that HybridRetriever actually
           attaches the RAW (unfused) lexical leg to the outcome (that property is only meaningful
           if lexical[0] is the lexical leg's own genuine rank-1 pick), and
           RetrievalOutcome.has_strong_lexical_match — the rank-1 agreement PLUS a lexical_coverage
           floor that keeps a degenerate single-common-word OR-fallback match (see
           components.repository.retrieve_lexical) from being trusted the same as a genuine
           AND-tier or multi-term match.
Layer:     test
May import:   pytest, numpy, app.components.hybrid_retriever, app.metrics, app.schemas.retrieval,
              tests.fakes/*
Must NOT import:  real asyncpg, real openai
"""
from __future__ import annotations

import numpy as np

from app.components.hybrid_retriever import HybridRetriever
from app.metrics import retrieval_leg_hits
from app.schemas.retrieval import RetrievalOutcome, RetrievalResult
from tests.fakes.fake_repository import FakeKnowledgeRepository

_QUERY_VEC = np.zeros(1536, dtype=np.float32)


def _hit(
    chunk_id: int, lexical_coverage: int | None = None, lexical_terms_total: int | None = None
) -> RetrievalResult:
    return RetrievalResult(
        id=chunk_id, text="текст", source="src", doc_type="instruction", district=None,
        similarity=0.9, lexical_coverage=lexical_coverage, lexical_terms_total=lexical_terms_total,
    )


def _leg_count(leg: str) -> float:
    return retrieval_leg_hits.labels(leg=leg)._value.get()  # noqa: SLF001 — no public reader


async def test_retrieve_increments_each_leg_by_its_own_hit_count() -> None:
    repo = FakeKnowledgeRepository(dense=[_hit(1), _hit(2)], lexical=[_hit(3)])
    retriever = HybridRetriever(repo, 60)
    before_dense, before_lexical = _leg_count("dense"), _leg_count("lexical")

    await retriever.retrieve("query", _QUERY_VEC, None, k=10)

    assert _leg_count("dense") == before_dense + 2
    assert _leg_count("lexical") == before_lexical + 1


async def test_retrieve_with_an_empty_leg_increments_it_by_zero() -> None:
    repo = FakeKnowledgeRepository(dense=[], lexical=[_hit(1)])
    retriever = HybridRetriever(repo, 60)
    before_dense, before_lexical = _leg_count("dense"), _leg_count("lexical")

    await retriever.retrieve("query", _QUERY_VEC, None, k=10)

    assert _leg_count("dense") == before_dense
    assert _leg_count("lexical") == before_lexical + 1


async def test_retrieve_attaches_the_raw_lexical_leg_to_the_outcome() -> None:
    """RetrievalOutcome.lexical must be the UNFUSED lexical leg (the same list retrieve_lexical
    returned, in its own rank order) — not the RRF-fused order. run_shared_tail's
    strong_lexical_match check depends on lexical[0] being the lexical leg's own genuine rank-1
    pick, independent of how RRF re-orders the fused list."""
    repo = FakeKnowledgeRepository(dense=[_hit(1)], lexical=[_hit(2), _hit(1)])
    retriever = HybridRetriever(repo, 60)

    outcome = await retriever.retrieve("query", _QUERY_VEC, None, k=10)

    assert [chunk.id for chunk in outcome.lexical] == [2, 1]
    assert outcome.lexical_top1_id == 2


def test_lexical_top1_id_is_none_when_lexical_leg_is_empty() -> None:
    outcome = RetrievalOutcome(dense=[], fused=[])
    assert outcome.lexical_top1_id is None


def test_lexical_top1_id_is_the_first_lexical_hits_id() -> None:
    outcome = RetrievalOutcome(dense=[], fused=[], lexical=[_hit(7), _hit(3)])
    assert outcome.lexical_top1_id == 7


# ---------------------------------------------------------------------------
# RetrievalOutcome.has_strong_lexical_match — rank-1 agreement AND a FULL-coverage requirement for
# OR-fallback hits (lexical_coverage == lexical_terms_total, not a plain minimum count — see the
# module docstring on why a minimum count can't tell a short query's only term (coverage=1 of 1,
# full) from one matching word out of several in a verbose query (coverage=1 of 3+, partial)).
# ---------------------------------------------------------------------------

def test_strong_match_is_false_when_fused_is_empty() -> None:
    outcome = RetrievalOutcome(dense=[], fused=[], lexical=[_hit(1)])
    assert outcome.has_strong_lexical_match is False


def test_strong_match_is_false_when_fused_top1_disagrees_with_lexical_top1() -> None:
    outcome = RetrievalOutcome(dense=[], fused=[_hit(1)], lexical=[_hit(2)])
    assert outcome.has_strong_lexical_match is False


def test_strong_match_is_true_when_lexical_coverage_is_none() -> None:
    """None means an AND-tier hit (websearch_to_tsquery/plainto_tsquery) — an all-or-nothing match
    by construction, so it's always trusted, exactly like before lexical_coverage existed."""
    hit = _hit(1, lexical_coverage=None, lexical_terms_total=None)
    outcome = RetrievalOutcome(dense=[], fused=[hit], lexical=[hit])
    assert outcome.has_strong_lexical_match is True


def test_strong_match_is_true_for_a_short_querys_single_term_fully_covered() -> None:
    """The exact real shape of "Де ЦНАП?": "де" is filtered out (< 3 letters), leaving "цнап" as
    the query's ONLY significant term, so the OR-fallback's coverage for the matching chunk is
    1 -- but 1 of 1 total is a COMPLETE match, not a partial one, and must be trusted. This is the
    live regression this exact test set caught: a plain "coverage >= 2" floor would reject this,
    since it can never distinguish a fully-covered single-term query from a partial one."""
    hit = _hit(1, lexical_coverage=1, lexical_terms_total=1)
    outcome = RetrievalOutcome(dense=[], fused=[hit], lexical=[hit])
    assert outcome.has_strong_lexical_match is True


def test_strong_match_is_false_for_a_partial_or_fallback_hit() -> None:
    """The exact shape of the real Jupiter-moons/borscht-recipe false positive: the fused top-1
    chunk agrees with the lexical leg's own rank-1 pick, but that lexical hit came from the
    OR-fallback matching on only ONE of several significant terms (coverage=1 of 3) — a partial,
    not genuine, match."""
    hit = _hit(1, lexical_coverage=1, lexical_terms_total=3)
    outcome = RetrievalOutcome(dense=[], fused=[hit], lexical=[hit])
    assert outcome.has_strong_lexical_match is False


def test_strong_match_is_true_for_a_multi_term_querys_full_coverage() -> None:
    """A chunk covering EVERY one of the query's significant terms is a real, specific match —
    trusted just like an AND-tier hit, confirming the rule isn't limited to single-term queries."""
    hit = _hit(1, lexical_coverage=2, lexical_terms_total=2)
    outcome = RetrievalOutcome(dense=[], fused=[hit], lexical=[hit])
    assert outcome.has_strong_lexical_match is True


def test_strong_match_is_false_for_a_higher_but_still_partial_coverage() -> None:
    """Confirms the rule is a RATIO, not an absolute count: covering 2 terms out of 4 is NOT
    trusted, even though 2 alone might look like "enough" by an absolute-count standard — it's
    still a minority of the query's actual significant terms."""
    hit = _hit(1, lexical_coverage=2, lexical_terms_total=4)
    outcome = RetrievalOutcome(dense=[], fused=[hit], lexical=[hit])
    assert outcome.has_strong_lexical_match is False


async def test_retrieve_reranks_lexical_leg_for_title_evidence() -> None:
    irrelevant = RetrievalResult(
        id=2,
        text="Мер Дортмунда розповів про міські події.",
        source="news",
        doc_type="news",
        district=None,
        similarity=0.0,
    )
    status = RetrievalResult(
        id=3,
        text="Мер (міський голова) Житомира наразі офіційно не обраний.",
        source="manual-curated",
        doc_type="instruction",
        district=None,
        similarity=0.0,
    )
    repo = FakeKnowledgeRepository(dense=[status], lexical=[irrelevant, status])
    retriever = HybridRetriever(repo, 60)

    outcome = await retriever.retrieve("Хто мер?", _QUERY_VEC, None, k=10)

    assert outcome.lexical_top1_id == 3
    assert outcome.has_strong_lexical_match is True
