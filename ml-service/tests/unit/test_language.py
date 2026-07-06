"""
Purpose:   Unit: is_ukrainian flags text carrying a Ukrainian-only letter (і/ї/є/ґ) as Ukrainian,
           and treats Russian / English / a Ukrainian query lacking those letters as non-Ukrainian
           (the safe "translate to be sure" direction). Pure string function — no I/O.
           resolve_answer_lang: the wartime "never answer in Russian" policy collapse — every
           input that isn't exactly "uk" or "en" (Russian included) resolves to "uk".
Layer:     test
May import:   pytest, app.domain.language
Must NOT import:  asyncpg, openai, FastAPI
"""
from __future__ import annotations

import pytest

from app.domain.language import detect_query_language, is_ukrainian, resolve_answer_lang


@pytest.mark.parametrize(
    "text",
    [
        "Як отримати субсидію?",          # і in субсидію
        "Де знайти ЦНАП у місті?",        # і in місті
        "Графік прийому громадян",         # і in графік
        "ІНФОРМАЦІЯ",                       # uppercase І
    ],
)
def test_ukrainian_specific_letters_flag_ukrainian(text: str) -> None:
    assert is_ukrainian(text) is True


@pytest.mark.parametrize(
    "text",
    [
        "как записаться на приём к мэру",           # Russian
        "how to apply for a utility subsidy",       # English
        "как оформить субсидию",                     # Russian, no UA-only letter
        "Коли дадуть воду?",                         # UA but no і/ї/є/ґ -> mis-flagged (safe)
    ],
)
def test_non_ukrainian_or_ambiguous_is_not_flagged(text: str) -> None:
    assert is_ukrainian(text) is False


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("Як отримати субсидію?", "uk"),            # UA-only letter
        ("how do I get free legal aid", "en"),      # Latin script
        ("в этом году положена субсидия", "ru"),    # RU-only letter (э)
        ("как получить помощь", "uk"),              # Cyrillic, no markers -> primary audience (UA)
        ("Коли дадуть воду?", "uk"),                # marker-poor UA -> stays UA, never Russian
    ],
)
def test_detect_query_language_biases_to_ukrainian(text: str, expected: str) -> None:
    assert detect_query_language(text) == expected


@pytest.mark.parametrize("lang", ["uk", "en"])
def test_resolve_answer_lang_passes_through_allowed_languages(lang: str) -> None:
    assert resolve_answer_lang(lang) == lang


@pytest.mark.parametrize(
    "lang",
    [
        "ru",       # the one this policy exists for: never answer in Russian
        "",         # empty/unknown code
        "fr",       # any other unrecognized code
        "UK",       # wrong case is NOT the allowed "uk" — must not slip through
    ],
)
def test_resolve_answer_lang_collapses_everything_else_to_ukrainian(lang: str) -> None:
    assert resolve_answer_lang(lang) == "uk"
