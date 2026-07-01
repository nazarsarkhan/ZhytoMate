"""
Purpose:   Pure heuristic query router (ADR-010): classify_query(query) -> QueryRoute (SIMPLE |
           COMPLEX) using word count + Ukrainian enumeration markers + question-mark count. Zero LLM,
           zero latency, no side effects. Biased toward SIMPLE — COMPLEX must be earned.
Layer:     domain (pure)
May import:   stdlib, schemas/common (QueryRoute)
Must NOT import:  api/*, services/*, components/*, pipeline/*; any I/O or model lib (asyncpg, FastAPI)
"""
from __future__ import annotations

import string

from app.schemas.common import QueryRoute

# Re-export so callers can keep `from app.domain.classifier import QueryRoute, classify_query`.
__all__ = ["QueryRoute", "classify_query"]

# A query long enough to almost certainly carry multiple intents.
_COMPLEX_WORD_THRESHOLD = 12

# Enumeration / multi-intent markers (Ukrainian/Russian). Single tokens are matched as whole words;
# multi-word entries are matched as phrases.
_MULTI_QUESTION_MARKERS = frozenset(
    [
        "і", "та", "також", "а також", "крім того",
        "по-перше", "по-друге", "по-третє",
    ]
)
_WORD_MARKERS = frozenset(m for m in _MULTI_QUESTION_MARKERS if " " not in m)
_PHRASE_MARKERS = tuple(m for m in _MULTI_QUESTION_MARKERS if " " in m)
_MARKER_MIN_WORDS = 6


def classify_query(query: str) -> QueryRoute:
    """
    Classify a query as SIMPLE or COMPLEX (first matching rule wins):

    1. >= 12 words                                    -> COMPLEX
    2. >= 2 question marks                             -> COMPLEX
    3. an enumeration marker AND >= 6 words            -> COMPLEX
    4. otherwise                                       -> SIMPLE
    """
    words = query.split()
    if len(words) >= _COMPLEX_WORD_THRESHOLD:
        return QueryRoute.COMPLEX
    if query.count("?") >= 2:
        return QueryRoute.COMPLEX
    if len(words) >= _MARKER_MIN_WORDS and _has_marker(query):
        return QueryRoute.COMPLEX
    return QueryRoute.SIMPLE


def _has_marker(query: str) -> bool:
    lowered = query.lower()
    tokens = {word.strip(string.punctuation) for word in lowered.split()}
    return bool(tokens & _WORD_MARKERS) or any(phrase in lowered for phrase in _PHRASE_MARKERS)
