"""
Purpose:   Unit: pipeline.base.run_shared_tail's confidence-gating logic in isolation, with a fake
           Generator standing in for the LLM — no pipeline (OPSEC gate, translation) scaffolding
           needed, since run_shared_tail is a plain function. Covers the strong_lexical_match
           override (a rank-1 lexical/RRF agreement can ground an answer despite a dense top1_sim
           below sim_gate — see the module docstring on run_shared_tail for the real "Де ЦНАП?" bug
           this fixes), its negative control (no override without a genuine rank-1 match), its
           precedence against force_ungrounded (conversational queries must stay ungrounded
           regardless), and the grounded_via_lexical_total counter (increments ONLY when the
           lexical signal was the actual deciding factor, not whenever it happens to be true).
Layer:     test
May import:   pytest, app.pipeline.base, app.domain.confidence, app.metrics, app.schemas/*,
              tests.fakes.fake_generator, tests.fakes.fake_embedder
Must NOT import:  real openai, real asyncpg
"""
from __future__ import annotations

from app.metrics import grounded_via_lexical_total
from app.pipeline.base import run_shared_tail
from app.schemas.common import QueryRoute
from app.schemas.retrieval import RetrievalResult
from tests.fakes.fake_embedder import FakeEmbedder
from tests.fakes.fake_generator import FakeGenerator

_SIM_GATE = 0.70
_SIM_HIGH = 0.80
_QUESTION = "Де ЦНАП?"
_COUNT_TOKENS = FakeEmbedder().count_tokens


def _hit(chunk_id: int, similarity: float, text: str) -> RetrievalResult:
    return RetrievalResult(
        id=chunk_id, text=text, source="src", doc_type="instruction", district=None,
        similarity=similarity,
    )


def _counter_value() -> float:
    return grounded_via_lexical_total._value.get()  # noqa: SLF001 — no public reader


async def test_strong_lexical_match_grounds_despite_low_dense_similarity() -> None:
    """Reproduces the real live bug: a short, keyword-heavy factual query's dense similarity tops
    out well below sim_gate even against the directly-relevant chunk (short queries are a
    structurally weak fit for dense cosine similarity), while that SAME chunk is the lexical leg's
    own #1 keyword match. That structural signal is enough to ground the answer even though
    top1_sim alone would refuse it."""
    hit = _hit(1, similarity=0.35, text="ЦНАП: вул. Ватутіна, 2/1, пн-пт 8:00-17:00.")
    generator = FakeGenerator(result=("ЦНАП знаходиться на вул. Ватутіна, 2/1.", 0))

    result = await run_shared_tail(
        generator=generator, sim_gate=_SIM_GATE, sim_high=_SIM_HIGH,
        count_tokens_fn=_COUNT_TOKENS, retrieved=[hit], top1_sim=0.35,
        question=_QUESTION, route=QueryRoute.SIMPLE, strong_lexical_match=True,
    )

    assert result.debug["grounded"] is True
    assert result.debug["strong_lexical_match"] is True
    assert len(result.sources_used) == 1
    assert result.answer == "ЦНАП знаходиться на вул. Ватутіна, 2/1."


async def test_low_similarity_without_strong_lexical_match_stays_ungrounded() -> None:
    """Negative control for the test above: the same low dense similarity, but no genuine rank-1
    lexical agreement — grounded must stay False, exactly as before this change. This is the test
    that actually protects against a regression that makes the OR-branch too permissive (e.g.
    grounding on ANY non-empty lexical result rather than specifically a rank-1 match)."""
    hit = _hit(1, similarity=0.35, text="нерелевантний фрагмент")
    generator = FakeGenerator(result=("Наразі не маю точних даних.", 0))

    result = await run_shared_tail(
        generator=generator, sim_gate=_SIM_GATE, sim_high=_SIM_HIGH,
        count_tokens_fn=_COUNT_TOKENS, retrieved=[hit], top1_sim=0.35,
        question=_QUESTION, route=QueryRoute.SIMPLE, strong_lexical_match=False,
    )

    assert result.debug["grounded"] is False
    assert result.debug["strong_lexical_match"] is False


async def test_force_ungrounded_wins_over_strong_lexical_match() -> None:
    """Precedence check: a conversational/small-talk classification (force_ungrounded=True) must
    override even a strong lexical match — a greeting must never get stuffed with civic context
    just because retrieval happened to surface a rank-1 keyword coincidence."""
    hit = _hit(1, similarity=0.35, text="ЦНАП: вул. Ватутіна, 2/1.")
    generator = FakeGenerator(result=("Привіт! Все добре.", 0))

    result = await run_shared_tail(
        generator=generator, sim_gate=_SIM_GATE, sim_high=_SIM_HIGH,
        count_tokens_fn=_COUNT_TOKENS, retrieved=[hit], top1_sim=0.35,
        question=_QUESTION, route=QueryRoute.SIMPLE,
        force_ungrounded=True, strong_lexical_match=True,
    )

    assert result.debug["grounded"] is False


async def test_high_dense_similarity_grounds_regardless_of_strong_lexical_match() -> None:
    """Sanity check the override doesn't interfere with the ordinary, already-working path: a
    passing dense similarity grounds normally whether or not strong_lexical_match is also True."""
    hit = _hit(1, similarity=0.9, text="Сміття вивозять щовівторка.")
    generator = FakeGenerator(result=("Сміття вивозять щовівторка.", 0))

    result = await run_shared_tail(
        generator=generator, sim_gate=_SIM_GATE, sim_high=_SIM_HIGH,
        count_tokens_fn=_COUNT_TOKENS, retrieved=[hit], top1_sim=0.9,
        question=_QUESTION, route=QueryRoute.SIMPLE, strong_lexical_match=False,
    )

    assert result.debug["grounded"] is True


async def test_no_information_answer_discards_retrieved_sources() -> None:
    """A semantically similar retrieval hit is not evidence when synthesis explicitly says the
    requested information is unavailable."""
    hit = _hit(1, similarity=0.9, text="Загальна інформація про міські послуги.")
    generator = FakeGenerator(
        result=("Інформації про те, де зробити паспорт у Житомирі, немає.", 0)
    )

    result = await run_shared_tail(
        generator=generator, sim_gate=_SIM_GATE, sim_high=_SIM_HIGH,
        count_tokens_fn=_COUNT_TOKENS, retrieved=[hit], top1_sim=0.9,
        question="Де зробити паспорт?", route=QueryRoute.SIMPLE,
    )

    assert result.debug["grounded"] is False
    assert result.debug["answer_no_info"] is True
    assert result.sources_used == []
    assert result.confidence == 0.0


# ---------------------------------------------------------------------------
# grounded_via_lexical_total — increments ONLY when the lexical signal was the actual deciding
# factor (dense similarity was in the NO_INFO band and strong_lexical_match flipped the outcome to
# grounded), never merely because strong_lexical_match happens to be True.
# ---------------------------------------------------------------------------

async def test_grounded_via_lexical_counter_increments_when_it_is_the_deciding_factor() -> None:
    hit = _hit(1, similarity=0.35, text="ЦНАП: вул. Ватутіна, 2/1.")
    generator = FakeGenerator(result=("ЦНАП на вул. Ватутіна, 2/1.", 0))
    before = _counter_value()

    await run_shared_tail(
        generator=generator, sim_gate=_SIM_GATE, sim_high=_SIM_HIGH,
        count_tokens_fn=_COUNT_TOKENS, retrieved=[hit], top1_sim=0.35,
        question=_QUESTION, route=QueryRoute.SIMPLE, strong_lexical_match=True,
    )

    assert _counter_value() == before + 1


async def test_lexical_counter_not_incremented_when_dense_alone_already_grounds() -> None:
    """Dense similarity alone already clears sim_gate here — strong_lexical_match being True too
    must NOT count as "the deciding factor", since it wasn't: dense would have grounded this
    regardless of the lexical signal."""
    hit = _hit(1, similarity=0.9, text="Сміття вивозять щовівторка.")
    generator = FakeGenerator(result=("Сміття вивозять щовівторка.", 0))
    before = _counter_value()

    await run_shared_tail(
        generator=generator, sim_gate=_SIM_GATE, sim_high=_SIM_HIGH,
        count_tokens_fn=_COUNT_TOKENS, retrieved=[hit], top1_sim=0.9,
        question=_QUESTION, route=QueryRoute.SIMPLE, strong_lexical_match=True,
    )

    assert _counter_value() == before


async def test_grounded_via_lexical_counter_does_not_increment_without_a_strong_match() -> None:
    hit = _hit(1, similarity=0.35, text="нерелевантно")
    generator = FakeGenerator(result=("Наразі не маю точних даних.", 0))
    before = _counter_value()

    await run_shared_tail(
        generator=generator, sim_gate=_SIM_GATE, sim_high=_SIM_HIGH,
        count_tokens_fn=_COUNT_TOKENS, retrieved=[hit], top1_sim=0.35,
        question=_QUESTION, route=QueryRoute.SIMPLE, strong_lexical_match=False,
    )

    assert _counter_value() == before


async def test_grounded_via_lexical_counter_does_not_increment_when_force_ungrounded_wins() -> None:
    """A conversational query can coincide with a strong rank-1 lexical match in retrieval (a
    keyword coincidence), but force_ungrounded still wins and the final answer is NOT grounded —
    the counter must not claim credit for a flip that didn't actually happen."""
    hit = _hit(1, similarity=0.35, text="ЦНАП: вул. Ватутіна, 2/1.")
    generator = FakeGenerator(result=("Привіт!", 0))
    before = _counter_value()

    result = await run_shared_tail(
        generator=generator, sim_gate=_SIM_GATE, sim_high=_SIM_HIGH,
        count_tokens_fn=_COUNT_TOKENS, retrieved=[hit], top1_sim=0.35,
        question=_QUESTION, route=QueryRoute.SIMPLE,
        force_ungrounded=True, strong_lexical_match=True,
    )

    assert result.debug["grounded"] is False
    assert _counter_value() == before
