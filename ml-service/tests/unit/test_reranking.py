from __future__ import annotations

from app.domain.reranking import rerank_results
from app.schemas.retrieval import RetrievalResult


def _hit(chunk_id: int, text: str) -> RetrievalResult:
    return RetrievalResult(
        id=chunk_id,
        text=text,
        source=f"source-{chunk_id}",
        doc_type="instruction",
        district=None,
        similarity=0.7,
    )


def test_reranker_prioritizes_direct_title_evidence_over_deputy_directory_match() -> None:
    results = [
        _hit(1, "Заступник міського голови Смаль О.А."),
        _hit(2, "Мером Житомира є Сергій Сухомлин."),
    ]

    ranked = rerank_results("Хто зараз мер Житомира?", results)

    assert [item.id for item in ranked] == [2, 1]


def test_reranker_prioritizes_explicit_unfilled_title_status() -> None:
    results = [
        _hit(1, "Мер Дортмунда розповів про міські події."),
        _hit(2, "Мер (міський голова) Житомира наразі офіційно не обраний."),
    ]

    ranked = rerank_results("Хто мер?", results)

    assert [item.id for item in ranked] == [2, 1]


def test_reranker_preserves_original_order_for_equal_relevance() -> None:
    results = [_hit(1, "Графік роботи ЦНАП"), _hit(2, "Графік роботи ЦНАП")]

    ranked = rerank_results("Графік роботи ЦНАП", results)

    assert [item.id for item in ranked] == [1, 2]
