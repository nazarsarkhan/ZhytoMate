"""
Purpose:   Pure query-language heuristics for the multilingual RAG entrypoint. is_ukrainian(text)
           returns True when the text carries a letter unique to the Ukrainian alphabet (і, ї, є, ґ)
           — letters Russian and English never use — a reliable "this is Ukrainian" signal that lets
           a Ukrainian query skip the retrieval-time translation step
           (pipeline/base.to_ukrainian_for_retrieval). detect_query_language(text) returns
           "uk"/"ru"/"en" for picking the language of fixed responses (e.g. the no-info message):
           it leaves Ukrainian only for UNAMBIGUOUS Russian (ы/э/ъ/ё) or Latin-script English, so
           the primary Ukrainian audience is never mis-served. A Ukrainian query using none of the
           marker letters is only ever mis-flagged, costing one harmless redundant translate call,
           never a missed one — so a False from is_ukrainian means "translate to be safe", not UA.
           resolve_answer_lang(detected_lang) collapses the detected input language to the
           policy-allowed ANSWER language: wartime policy is that this assistant never answers in
           Russian, regardless of what language the question was asked in — a deliberate stance,
           not a technical limitation (detection/translation of Russian input is unaffected). Every
           caller that picks an answer's language MUST route through this function, not use a
           detected/input language directly.
Layer:     domain (pure — no I/O, no model libs)
May import:   stdlib only
Must NOT import:  api/*, services/*, components/*, pipeline/*; asyncpg, openai, FastAPI
"""
from __future__ import annotations

# Letters in the Ukrainian alphabet but absent from Russian and English. Their presence is a
# reliable "this is Ukrainian" signal; their absence is inconclusive (short queries may lack them).
_UKRAINIAN_ONLY_LETTERS = frozenset("іїєґ")
# Letters in the Russian alphabet but absent from Ukrainian — the only unambiguous "this is Russian"
# signal (Cyrillic without these stays "uk" so a marker-poor Ukrainian query is never mis-served).
_RUSSIAN_ONLY_LETTERS = frozenset("ыэъё")

# The only languages this assistant is ever allowed to ANSWER in (wartime policy — see module
# docstring). Deliberately excludes "ru": detect_query_language may still return "ru" for logging/
# retrieval purposes, but no answer-language decision may ever select it.
ANSWER_LANGUAGES = frozenset({"uk", "en"})


def is_ukrainian(text: str) -> bool:
    """True if the text contains any Ukrainian-only letter (і/ї/є/ґ, case-insensitive)."""
    return any(ch in _UKRAINIAN_ONLY_LETTERS for ch in text.lower())


def detect_query_language(text: str) -> str:
    """Best-effort language of the query for choosing a fixed response's language: 'uk', 'ru', or
    'en'. Biased toward the primary Ukrainian audience — only clearly-Russian (ы/э/ъ/ё) or
    Latin-script English text is switched away from 'uk'."""
    if is_ukrainian(text):
        return "uk"
    lowered = text.lower()
    if any(ch in _RUSSIAN_ONLY_LETTERS for ch in lowered):
        return "ru"
    if any("а" <= ch <= "я" for ch in lowered):  # Cyrillic, no markers -> assume majority (UA)
        return "uk"
    if any("a" <= ch <= "z" for ch in lowered):
        return "en"
    return "uk"


def resolve_answer_lang(detected_lang: str) -> str:
    """Collapse a detected/input language to the policy-allowed ANSWER language. Wartime policy:
    this assistant never answers in Russian, regardless of the question's language — 'ru' (and any
    other unrecognized code) resolves to 'uk'. Detection/translation of Russian queries elsewhere
    in the pipeline is unaffected; only the language chosen for the reply goes through here."""
    return detected_lang if detected_lang in ANSWER_LANGUAGES else "uk"
