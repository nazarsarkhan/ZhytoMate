from app.domain.civic_intent import classify_civic_intent


def test_service_aliases_share_services_category() -> None:
    assert classify_civic_intent("Де ЦНАП?").category is None
    assert classify_civic_intent("где сделать паспорт?").category is None


def test_utility_and_transport_aliases_are_separated() -> None:
    assert classify_civic_intent("Де купити воду в центрі?").category == "utilities"
    assert classify_civic_intent("Який тролейбус їде до вокзалу?").category == "transport"
    assert classify_civic_intent("Який маршрут тролейбуса №15А?").category is None


def test_ambiguous_question_keeps_broad_retrieval() -> None:
    assert classify_civic_intent("Що нового в Житомирі?").category is None
