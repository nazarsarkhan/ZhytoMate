"""Resident-facing civic vocabulary and abbreviation aliases.

This module is the single source of truth for short forms residents use in chat.  It is kept in
the domain layer so the safety classifier, intent router, and retrieval canonicalizer all agree
that ``ВПО``, ``ЦНАП``, ``ДМС`` and similar terms are civic information requests.

The retrieval anchors deliberately use vocabulary found in official Zhytomyr pages.  They are
search keys, not hardcoded answers: the final response still requires retrieved official evidence.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from functools import lru_cache


@dataclass(frozen=True)
class CivicGlossaryEntry:
    """One abbreviation/alias family understood by the civic question flow."""

    key: str
    aliases: tuple[str, ...]
    meaning: str
    retrieval_query: str | None = None


# Keep specific multi-word aliases before short abbreviations.  Entries without a retrieval query
# still participate in civic detection; their original wording remains safer than inventing a
# weak canonical search key.
CIVIC_GLOSSARY: tuple[CivicGlossaryEntry, ...] = (
    CivicGlossaryEntry(
        key="cnap",
        aliases=(
            "цнап",
            "центр надання адміністративних",
            "прозорий офіс",
            "прозрачный офис",
        ),
        meaning="центр надання адміністративних послуг",
    ),
    CivicGlossaryEntry(
        key="vpo",
        aliases=(
            "впо",
            "в.п.о",
            "внутрішньо переміщ",
            "внутренне перемещ",
            "переселен",
        ),
        meaning="внутрішньо переміщена особа",
        retrieval_query="Прозорий офіс отримати паспорт внутрішньо переміщеним особам",
    ),
    CivicGlossaryEntry(
        key="passport",
        aliases=(
            "паспорт",
            "паспортний документ",
            "паспортный документ",
            "id-карт",
            "айді-карт",
            "закордонний паспорт",
            "загранпаспорт",
        ),
        meaning="паспортні та документальні послуги",
        retrieval_query="Прозорий офіс отримати паспорт",
    ),
    CivicGlossaryEntry(
        key="migration_service",
        aliases=("дмс", "державна міграційна служба", "миграционная служба"),
        meaning="Державна міграційна служба",
        retrieval_query="Прозорий офіс отримати паспорт",
    ),
    CivicGlossaryEntry(
        key="social_services",
        aliases=(
            "соцзахист",
            "соцслужба",
            "соціальна служба",
            "управління соцзахисту",
            "усзн",
            "пфу",
            "пенсійний фонд",
            "пенсионный фонд",
        ),
        meaning="соціальні та пенсійні послуги",
        retrieval_query="Соціальні послуги Житомирської громади",
    ),
    CivicGlossaryEntry(
        key="tax_id",
        aliases=("рнокпп", "рнокпп", "іпн", "інн", "ідентифікаційний код"),
        meaning="реєстраційний номер облікової картки платника податків",
        retrieval_query="ідентифікаційний код РНОКПП",
    ),
    CivicGlossaryEntry(
        key="business_registry",
        aliases=("єдрпоу", "едрпоу", "єдр", "единый госреестр"),
        meaning="державні реєстри юридичних осіб та підприємців",
        retrieval_query="ЄДРПОУ реєстрація юридичної особи",
    ),
    CivicGlossaryEntry(
        key="housing_utilities",
        aliases=("жкг", "житлово-комунальні", "комуналка", "осбб"),
        meaning="житлово-комунальні послуги та ОСББ",
        retrieval_query="Житлово-комунальні питання",
    ),
    CivicGlossaryEntry(
        key="police_and_documents",
        aliases=("мвс", "гсц мвс", "сервісний центр мвс", "сервисный центр мвс"),
        meaning="сервісні послуги Міністерства внутрішніх справ",
    ),
    CivicGlossaryEntry(
        key="military_registration",
        aliases=("тцк", "тцк та сп", "військовий облік"),
        meaning="територіальний центр комплектування та соціальної підтримки",
    ),
    CivicGlossaryEntry(
        key="public_health_provider",
        aliases=("кнп", "комунальне некомерційне підприємство"),
        meaning="комунальний заклад охорони здоров’я",
    ),
    CivicGlossaryEntry(
        key="diia",
        aliases=("дія", "дия", "державні онлайн-послуги"),
        meaning="державний портал цифрових послуг Дія",
    ),
)


@lru_cache(maxsize=64)
def _alias_pattern(alias: str) -> re.Pattern[str]:
    escaped = re.escape(alias.strip())
    # Stem-like aliases cover inflected forms: ``переміщ`` -> ``переміщена`` and ``паспорт`` ->
    # ``паспортний``.  Punctuation in abbreviations remains literal.
    if alias and alias[-1].isalnum():
        escaped += r"\w*"
    return re.compile(rf"(?<!\w){escaped}(?!\w)", re.IGNORECASE)


def find_civic_glossary_entries(question: str) -> tuple[CivicGlossaryEntry, ...]:
    """Return glossary families present in a resident's question."""
    return tuple(
        entry
        for entry in CIVIC_GLOSSARY
        if any(_alias_pattern(alias).search(question) for alias in entry.aliases)
    )


def is_glossary_civic_question(question: str) -> bool:
    """Return whether an abbreviation/alias identifies a factual civic request."""
    return bool(find_civic_glossary_entries(question))


def glossary_retrieval_query(question: str) -> str | None:
    """Return the official-vocabulary retrieval anchor for the first matching family."""
    for entry in find_civic_glossary_entries(question):
        if entry.retrieval_query:
            return entry.retrieval_query
    return None
