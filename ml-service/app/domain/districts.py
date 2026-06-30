"""
Purpose:   Closed district vocabulary {bohunskyi, korolovskyi} + surface-form map;
           canonicalize_district(raw) -> slug | None (§2.6). Single source of truth imported by
           BOTH the ingest and the query path so the two can never drift.
Layer:     domain
May import:   stdlib
Must NOT import:  api/*, services/*, components/*; any I/O or model lib (asyncpg, google-genai, sentence-transformers, FastAPI)
"""
from __future__ import annotations

# Closed vocabulary — Zhytomyr has exactly two urban districts (§2.6).
KNOWN_SLUGS: frozenset[str] = frozenset({"bohunskyi", "korolovskyi"})

# Every known surface form -> canonical slug. Covers official Ukrainian spelling, common
# declensions, transliteration variants, colloquial names, and Russian spellings.
_SURFACE_MAP: dict[str, str] = {
    # Bohunskyi
    "богунський район": "bohunskyi",
    "богунський": "bohunskyi",
    "богунського": "bohunskyi",
    "богунському": "bohunskyi",
    "богунська": "bohunskyi",
    "богунка": "bohunskyi",
    "богунський р-н": "bohunskyi",
    "bohunskyi": "bohunskyi",
    "bohunsky": "bohunskyi",
    "bogunsky": "bohunskyi",
    "bogunski": "bohunskyi",
    # Korolovskyi
    "корольовський район": "korolovskyi",
    "корольовський": "korolovskyi",
    "корольовського": "korolovskyi",
    "корольовському": "korolovskyi",
    "корольовська": "korolovskyi",
    "корольовський р-н": "korolovskyi",
    "королевский": "korolovskyi",  # Russian spelling
    "королёвский": "korolovskyi",  # Russian spelling
    "korolovskyi": "korolovskyi",
    "korolovsky": "korolovskyi",
    "korolivskyi": "korolovskyi",
}


def canonicalize_district(raw: str | None) -> str | None:
    """
    Map a raw district string to a canonical slug.

    Returns the slug ("bohunskyi" | "korolovskyi") when ``raw`` matches a known surface form,
    or None when ``raw`` is None or unrecognized (the city-wide fallback).

    Callers must log a WARNING when None is returned from a non-None input, so the team can grow
    the vocabulary from real misses during the demo (§2.6 / district_unmapped_total).
    """
    if raw is None:
        return None
    return _SURFACE_MAP.get(raw.strip().lower())  # None when unrecognized
