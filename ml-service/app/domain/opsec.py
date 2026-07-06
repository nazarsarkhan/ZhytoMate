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

           This is layer 1 of 2 (see pipeline/base.check_query_safety): layer 2 is an LLM
           classification pass that catches paraphrased/creative attempts this fixed phrase list
           cannot. This list is a starting point — extend it as new risk phrasing is identified;
           it is not, and can never be, exhaustive on its own.
Layer:     domain (pure — no I/O, no model libs)
May import:   stdlib only
Must NOT import:  api/*, services/*, components/*, pipeline/*; asyncpg, openai, FastAPI
"""
from __future__ import annotations

_OPSEC_INTENT_PHRASES = frozenset(
    {
        # coordinates / exact location of something sensitive
        "координати",
        "координаты",
        "coordinates",
        "точне розташування",
        "точное расположение",
        "exact location",
        "точна адреса",
        "точный адрес",
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


def contains_opsec_risk_terms(text: str) -> bool:
    """True if the text contains an explicit reconnaissance-flavored phrase. Case-insensitive
    substring match — deliberately simple and fast; see module docstring for what it does and does
    not cover, and why."""
    lowered = text.lower()
    return any(phrase in lowered for phrase in _OPSEC_INTENT_PHRASES)
