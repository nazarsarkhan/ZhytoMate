"""
Purpose:   Retrieval transfer types shared across layers: RetrievalResult (one retrieved chunk,
           dense or lexical) and RetrievalOutcome (the dense leg + the RRF-fused leg + the raw
           lexical leg together). Lives in schemas — not components/repository — so app.protocols
           (which may only import schemas/domain types, never components/*) can type
           Retriever.retrieve()'s return value. RetrievalOutcome.dense_top1_sim preserves the
           load-bearing distinction the confidence gate relies on: the dense-only top-1 cosine,
           never the RRF-fused order/score. RetrievalOutcome.lexical (and its lexical_top1_id
           convenience property) exists for a second, complementary gating signal: dense cosine
           similarity is a structurally weak fit for short, keyword-heavy factual queries (e.g.
           "Де ЦНАП?") even against a directly-relevant chunk, but that same chunk is often
           trivially the lexical leg's own #1 keyword match. RetrievalResult.lexical_coverage /
           lexical_terms_total (only ever set on lexical-leg results —
           components.repository.retrieve_lexical) record how many of the query's significant
           terms a chunk covered, and how many significant terms the query had in total, when the
           hit came from the OR-fallback tier; both `None` for a dense-leg result or an AND-tier
           lexical hit (websearch_to_tsquery/plainto_tsquery are all-or-nothing matches, so
           "coverage" isn't a meaningful concept there — an AND-tier hit is always fully covered by
           definition). This exists because the OR-fallback, on a query whose real subject has zero
           KB overlap, can degrade to matching on a single corpus-common word (e.g.
           "українського") in totally unrelated content. `RetrievalOutcome.has_strong_lexical_match`
           trusts an OR-fallback hit only when `lexical_coverage == lexical_terms_total` — a FULL
           match, not merely "at least N terms" — because a short, single-keyword query (like "Де
           ЦНАП?", where "цнап" is its only significant term) can only ever produce coverage=1,
           and that IS a complete, exhaustive match; a verbose query where only one word out of
           several coincidentally matches (coverage=1 of 3+) is a partial, untrustworthy one. An
           absolute minimum count (e.g. ">= 2") cannot tell these two coverage=1 cases apart, which
           is exactly why this uses a ratio against the query's own term count instead.
Layer:     schema
May import:   stdlib (dataclasses)
Must NOT import:  api/*, services/*, components/*, domain/*; any I/O or model lib (asyncpg, FastAPI
              routing)
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class RetrievalResult:
    """One retrieved chunk (internal transfer)."""

    id: int
    text: str
    source: str
    doc_type: str
    district: str | None
    similarity: float                # cosine [0,1] for the dense leg; 0.0 for the lexical leg
    # Only meaningful on a lexical-leg result from the OR-fallback tier: how many of the query's
    # significant terms this chunk covered, and how many significant terms the query had in total.
    # Both None for a dense-leg result or an AND-tier lexical hit (an all-or-nothing match, so
    # "coverage" doesn't apply — see module docstring).
    lexical_coverage: int | None = None
    lexical_terms_total: int | None = None


@dataclass
class RetrievalOutcome:
    """Three views of a hybrid retrieval call: the dense-only list (confidence gate), the RRF-fused
    list (context selection), and the raw lexical-only list (the second confidence-gate signal —
    see module docstring). Kept as separate fields rather than collapsing to one list, since the
    orderings answer different questions and must never be conflated. `lexical` defaults to empty
    so existing call sites/tests that only ever cared about dense+fused keep working unchanged."""

    dense: list[RetrievalResult]
    fused: list[RetrievalResult]
    lexical: list[RetrievalResult] = field(default_factory=list)

    @property
    def dense_top1_sim(self) -> float:
        return self.dense[0].similarity if self.dense else 0.0

    @property
    def lexical_top1_id(self) -> int | None:
        return self.lexical[0].id if self.lexical else None

    @property
    def has_strong_lexical_match(self) -> bool:
        """True when the fused list's own top-1 chunk agrees with the lexical leg's own rank-1
        pick AND that lexical hit isn't a degenerate partial OR-fallback coincidence. An AND-tier
        hit (lexical_coverage=None) is always trusted — it's an all-or-nothing match by
        construction. An OR-fallback hit is trusted only when it covers ALL of the query's
        significant terms (lexical_coverage == lexical_terms_total, a FULL match) — a short,
        single-keyword query can only ever produce coverage=1, and that's a complete match; a
        verbose query where only one word out of several coincidentally matches is a partial one
        and is not trusted, however many terms happen to match (see module docstring for why an
        absolute minimum count can't tell these two coverage=1 cases apart)."""
        if not self.fused or self.fused[0].id != self.lexical_top1_id:
            return False
        top = self.lexical[0]
        return top.lexical_coverage is None or top.lexical_coverage == top.lexical_terms_total
