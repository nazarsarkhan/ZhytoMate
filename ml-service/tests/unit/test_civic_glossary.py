from app.domain.civic_glossary import (
    find_civic_glossary_entries,
    glossary_retrieval_query,
    is_glossary_civic_question,
)


def test_glossary_recognizes_common_abbreviations() -> None:
    entries = {entry.key for entry in find_civic_glossary_entries("Де оформити ВПО через ДМС?")}
    assert {"vpo", "migration_service"} <= entries
    assert is_glossary_civic_question("Мені треба РНОКПП") is True


def test_glossary_returns_official_retrieval_anchor() -> None:
    assert glossary_retrieval_query("де зробити паспорт?") == "Прозорий офіс отримати паспорт"
    assert glossary_retrieval_query("Мені треба ВПО") == (
        "Прозорий офіс отримати паспорт внутрішньо переміщеним особам"
    )
