"""
Purpose:   Pure, fast, deterministic first-pass content-safety heuristic for wartime OPSEC risk.
           contains_opsec_risk_terms(text) flags queries carrying explicit reconnaissance-flavored
           phrasing (uk/ru/en) — asking for coordinates/exact locations of something sensitive,
           security vulnerabilities, guard schedules or their absence, movement/patrol routes,
           troop counts, or military deployment/dislocation — so they can be refused before ever
           reaching retrieval or generation, at zero cost and zero latency.

           Deliberately narrow: this matches INTENT-flavored phrases, not mere mentions of
           military/infrastructure words. Ordinary civic content legitimately mentions the Armed
           Forces (memorial news for fallen defenders, support/donation drives) and infrastructure
           (utility contacts, outage schedules) — blocking on a bare word like "military" or "water
           utility" would break this assistant's actual job. Nobody asks "the water company's guard
           schedule" or "coordinates of the checkpoint" for a legitimate civic reason, so matching
           on the INTENT phrasing itself keeps false positives low while still catching blunt
           attempts.

           The "coordinates / exact location" phrases are a special case: unlike every other
           category here, "координати"/"точна адреса"/"exact location" etc. are NOT
           intent-flavored on their own — "what's the exact address of the CNAP/pharmacy/aid
           point" is one of the most common ordinary civic questions this assistant gets. So
           these phrases only flag when the SAME query also names a sensitive target (military/
           checkpoint/guard-post flavored) via _SENSITIVE_TARGET_TERMS — see
           _mentions_location_of_sensitive_target. Every other category's phrases already bake
           the sensitive target into the phrase itself (e.g. "troop count", "guard schedule") so
           they stay unconditional substring matches.

           This is layer 1 of 2 (see pipeline/base.check_query_safety): layer 2 is an LLM
           classification pass that catches paraphrased/creative attempts this fixed phrase list
           cannot. This list is a starting point — extend it as new risk phrasing is identified;
           it is not, and can never be, exhaustive on its own.
Layer:     domain (pure — no I/O, no model libs)
May import:   stdlib only
Must NOT import:  api/*, services/*, components/*, pipeline/*; asyncpg, openai, FastAPI
"""
from __future__ import annotations

# Coordinates / exact-location phrases — conditional, see module docstring. Require co-occurrence
# with _SENSITIVE_TARGET_TERMS, since "exact address of X" is ordinary civic phrasing on its own.
_OPSEC_LOCATION_PHRASES = frozenset(
    {
        "координати",
        "координаты",
        "coordinates",
        "точне розташування",
        "точное расположение",
        "exact location",
        "точна адреса",
        "точный адрес",
    }
)

# Military/security-flavored nouns that turn a bare location phrase into a real OPSEC risk. Kept
# narrow and specific (not bare words like "охорони"/"guard" alone, which "заклад охорони
# здоров'я" — healthcare facility — would false-positive on).
_SENSITIVE_TARGET_TERMS = frozenset(
    {
        "блокпост",
        "checkpoint",
        "гарнізон",
        "garrison",
        "військ",
        "войск",
        "military",
        "зсу",
        "вcу",
        "ппо",
        "пво",
        "air defense",
        "air defence",
        "застав",
        "outpost",
    }
)

_OPSEC_INTENT_PHRASES = frozenset(
    {
        # security vulnerabilities / weak points
        "вразливість",
        "вразливості",
        "уязвимост",
        "vulnerabilit",
        "слабке місце",
        "слабкое место",
        "security gap",
        "security flaw",
        # guard/security schedule, or its absence
        "графік охорони",
        "график охраны",
        "guard schedule",
        "security schedule",
        "без охорони",
        "без охраны",
        "unguarded",
        "no guard",
        "коли немає охорони",
        "когда нет охраны",
        # movement / patrol routes and timing
        "маршрут пересування",
        "маршрут передвижения",
        "маршрут патрулювання",
        "маршрут патрулирования",
        "patrol route",
        "movement route",
        "travel route of",
        # troop / equipment counts and military deployment
        "чисельність військ",
        "численность войск",
        "troop count",
        "troop numbers",
        "дислокація",
        "дислокация",
        "deployment location",
        "розташування військових",
        "расположение военных",
        "military position",
        "military positions",
        "розташування зсу",
        "расположение вcу",
        "позиції ппо",
        "позиции пво",
        "air defense position",
        "air defense positions",
        # explicit intelligence/reconnaissance framing
        "для розвідки",
        "для разведки",
        "for reconnaissance",
        "for intelligence purposes",
        "intelligence gathering",
    }
)


def _mentions_location_of_sensitive_target(lowered: str) -> bool:
    """True if `lowered` pairs a coordinates/exact-location phrase with a sensitive target — e.g.
    "exact coordinates of the checkpoint", not just "exact address" on its own. See module
    docstring for why this category needs co-occurrence instead of a bare substring match."""
    has_location_phrase = any(phrase in lowered for phrase in _OPSEC_LOCATION_PHRASES)
    has_sensitive_target = any(term in lowered for term in _SENSITIVE_TARGET_TERMS)
    return has_location_phrase and has_sensitive_target


def contains_opsec_risk_terms(text: str) -> bool:
    """True if the text contains an explicit reconnaissance-flavored phrase. Case-insensitive
    substring match — deliberately simple and fast; see module docstring for what it does and does
    not cover, and why."""
    lowered = text.lower()
    if any(phrase in lowered for phrase in _OPSEC_INTENT_PHRASES):
        return True
    return _mentions_location_of_sensitive_target(lowered)
