"""Deterministic routing hints for Zhytomyr civic questions.

The classifier is intentionally conservative: it only adds a PostgreSQL category filter when the
wording identifies a service domain clearly. Unknown questions keep the broad hybrid search so a
newly ingested category is never made unreachable by an incomplete alias list.
"""
from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass(frozen=True)
class CivicIntent:
    category: str | None = None


_CATEGORY_RULES: tuple[tuple[str, re.Pattern[str]], ...] = (
    # Official service pages are currently mixed between `utilities` and NULL categories by the
    # legacy parser taxonomy. Keep this domain broad until category aliases are migrated, otherwise
    # a valid CNAP document is filtered out before lexical retrieval can see it.
    (None, re.compile(r"\b(?:цнап|паспорт\w*|документ\w*|субсид\w*|пільг\w*|послуг\w*)\b", re.I)),
    (None, re.compile(r"\b(?:маршрут\w*|маршрутка\w*|тролейбус\w*|автобус\w*)(?:\s+\w+){0,2}\s*№?\s*\d", re.I)),
    ("utilities", re.compile(r"\b(?:вод\w*|опал\w*|смітт\w*|свет\w*|світл\w*|комунал\w*|тариф\w*)\b", re.I)),
    ("transport", re.compile(r"\b(?:маршрут\w*|тролейбус\w*|автобус\w*|транспорт\w*|зупин\w*|проїзд\w*)\b", re.I)),
)


def classify_civic_intent(question: str) -> CivicIntent:
    """Return a category only for an unambiguous city-service vocabulary match."""
    for category, pattern in _CATEGORY_RULES:
        if pattern.search(question):
            return CivicIntent(category=category)
    return CivicIntent()
