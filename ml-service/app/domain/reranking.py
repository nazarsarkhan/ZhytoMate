"""Cheap deterministic reranking for hybrid retrieval results.

The reranker only changes order. It never invents evidence and it keeps the original order for
ties, so it is safe to run on every request without an additional model call.
"""
from __future__ import annotations

import re

from app.schemas.retrieval import RetrievalResult

_TOKEN_RE = re.compile(r"[^\W\d_]{3,}", re.UNICODE)
_TITLE_QUERY_RE = re.compile(
    r"\b(мер|мэр|мером|мэром|міський\s+голова|городской\s+голова)\b",
    re.IGNORECASE,
)
_DEPUTY_RE = re.compile(
    r"\b(заступник|заступники|заместитель|заместители|deputy|assistant)\b",
    re.IGNORECASE,
)
_DIRECT_TITLE_RE = re.compile(
    r"(?:мером|мэром|міський\s+голова|городской\s+голова)\s+"
    r"[^.!?\n]{0,80}(?:є|—|-|:)\s+[^.!?\n]{2,}",
    re.IGNORECASE,
)
_TITLE_STATUS_RE = re.compile(
    r"\b(?:мер|мэр)\b(?:\s*\([^)]{0,60}\))?[^.!?\n]{0,120}"
    r"\b(?:не\s+обран(?:ий|а|о)?|склав\s+повноваження|не\s+обира(?:вся|ється))\b",
    re.IGNORECASE,
)


def _tokens(text: str) -> set[str]:
    return set(_TOKEN_RE.findall(text.lower()))


def _relevance(query: str, result: RetrievalResult) -> tuple[int, int, float]:
    query_tokens = _tokens(query)
    overlap = len(query_tokens & _tokens(result.text))
    title_query = bool(_TITLE_QUERY_RE.search(query))
    title_bonus = 0
    if title_query:
        if (
            (_DIRECT_TITLE_RE.search(result.text) or _TITLE_STATUS_RE.search(result.text))
            and not _DEPUTY_RE.search(result.text)
        ):
            title_bonus = 100
        elif _DEPUTY_RE.search(result.text):
            title_bonus = -100
    return title_bonus, overlap, result.similarity


def rerank_results(query: str, results: list[RetrievalResult]) -> list[RetrievalResult]:
    """Return results ordered by evidence-aware relevance while preserving stable ties."""
    return sorted(results, key=lambda result: _relevance(query, result), reverse=True)
