import pytest

from app.domain.civic_verification import (
    extract_trusted_civic_answer,
    extract_trusted_civic_title_answer,
    is_civic_information_query,
    is_civic_title_query,
    is_no_information_answer,
    is_trusted_civic_source,
    is_trusted_title_source,
    normalize_civic_information_query,
    normalize_civic_title_query,
    verify_civic_context,
)


def test_recognizes_ukrainian_and_russian_no_information_answers() -> None:
    assert is_no_information_answer(
        "Інформації про те, де зробити паспорт у Житомирі, немає."
    ) is True
    assert is_no_information_answer(
        "На жаль, у мене немає підтвердженої інформації про суд."
    ) is True
    assert is_no_information_answer("На жаль, точних даних немає.") is True


def test_does_not_classify_a_real_answer_as_no_information() -> None:
    assert is_no_information_answer(
        "Паспорт можна оформити у ЦНАП за адресою: вул. Ватутіна, 2/1."
    ) is False


def test_recognizes_factual_city_service_questions() -> None:
    assert is_civic_information_query("А где суд?") is True
    assert is_civic_information_query("Где сделать паспорт?") is True
    assert is_civic_information_query("Куда пойти поесть в Житомире?") is True
    assert is_civic_information_query("Привіт, як справи?") is False


def test_normalizes_short_civic_location_questions() -> None:
    assert normalize_civic_information_query("А где суд?") == "Де суд у Житомирі?"
    assert normalize_civic_information_query(
        "где сделать паспорт?"
    ) == "Прозорий офіс отримати паспорт"


def test_recognizes_vpo_aliases_and_uses_official_service_vocabulary() -> None:
    assert is_civic_information_query("Мені треба ВПО") is True
    assert is_civic_information_query("де зробити впо?") is True
    assert normalize_civic_information_query("Мені треба документи для ВПО") == (
        "Прозорий офіс отримати паспорт внутрішньо переміщеним особам"
    )


def test_rejects_promoting_deputy_mayor_to_mayor() -> None:
    result = verify_civic_context(
        "Скажіть, хто мер?",
        ["Заступники міського голови: Смаль О.А."],
    )

    assert result.blocked is True
    assert result.reason == "title_not_supported"


def test_rejects_directory_boilerplate_without_punctuation() -> None:
    result = verify_civic_context(
        "Скажіть, хто мер?",
        ["Заступники міського головиСмаль О.А."],
    )

    assert result.blocked is True


def test_accepts_explicit_mayor_context() -> None:
    result = verify_civic_context(
        "Хто мер Житомира?",
        ["Міський голова Житомира — Ім'я Прізвище."],
    )

    assert result.blocked is False


def test_accepts_explicit_unfilled_mayor_status_and_acting_official() -> None:
    result = verify_civic_context(
        "А хто мер Житомира?",
        [
            "Мер (міський голова) Житомира наразі офіційно не обраний. "
            "Обов'язки міського голови виконує секретар міської ради "
            "Галина Степанівна Шиманська."
        ],
    )

    assert result.blocked is False


def test_extracts_title_answer_from_trusted_context_without_llm_paraphrase() -> None:
    answer = extract_trusted_civic_title_answer(
        "мерчик Житомира",
        [
            (
                "Мер (міський голова) Житомира наразі офіційно не обраний. "
                "Обов'язки міського голови виконує секретар міської ради Галина Шиманська.",
                "manual-curated",
            )
        ],
    )

    assert answer == (
        "За підтвердженою інформацією: Мер (міський голова) Житомира наразі офіційно не обраний."
    )


def test_does_not_extract_title_answer_from_untrusted_context() -> None:
    assert extract_trusted_civic_title_answer(
        "Хто мер Житомира?",
        [("Міський голова Житомира — Ім'я Прізвище", "https://example.com")],
    ) is None


def test_rejects_title_question_without_explicit_title_evidence() -> None:
    result = verify_civic_context(
        "Хто мер Житомира?",
        ["Житомирська міська рада. Контакти та перелік установ."],
    )

    assert result.blocked is True


def test_does_not_block_unrelated_civic_question() -> None:
    result = verify_civic_context(
        "Де ЦНАП?",
        ["ЦНАП розташований на вул. Михайлівській, 4."],
    )

    assert result.blocked is False


def test_recognizes_colloquial_and_typo_title_forms() -> None:
    assert is_civic_title_query("Хто мэрчик?") is True
    assert is_civic_title_query("Кто мэрито?") is True
    assert is_civic_title_query("Кто руководит городом Житомиром?") is True
    assert is_civic_title_query("Хто очолює місто?") is True
    assert is_civic_title_query("Хто голова міста Житомир?") is True


def test_normalizes_colloquial_and_typo_title_forms_for_retrieval() -> None:
    assert normalize_civic_title_query("Хто мэрчик?") == "Хто мер?"
    assert normalize_civic_title_query("Кто мэрито?") == "Кто мер?"
    assert normalize_civic_title_query("кто глава города Житомир") == "Хто мер Житомира?"
    assert normalize_civic_title_query("Хто голова міста Житомир?") == "Хто мер Житомира?"


def test_normalizes_russian_current_mayor_question_to_stable_title_anchor() -> None:
    assert normalize_civic_title_query("Кто сейчас мэр Житомира?") == "Хто мер Житомира?"


@pytest.mark.parametrize(
    ("question", "expected"),
    [
        ("де зареєструвати ФОП?", "Де зареєструвати ФОП у Житомирі?"),
        ("как оплатить коммуналку?", "Як оплатити комунальні послуги в Житомирі?"),
        ("дай адрес мэрии", "Контакти Житомирської міської ради адреса телефони"),
        ("хто виконує обов'язки мера?", "Хто виконує обов'язки міського голови Житомира?"),
    ],
)
def test_normalizes_high_value_short_civic_questions(question: str, expected: str) -> None:
    assert is_civic_information_query(question) is True
    assert normalize_civic_information_query(normalize_civic_title_query(question)) == expected


@pytest.mark.parametrize(
    ("question", "required"),
    [
        ("де зареєструвати ФОП?", "вул. Бориса Лятошинського, 15-Б"),
        ("дай адрес мэрии", "майдан ім. С. П. Корольова, 4/2"),
        ("скажи номер телефона мэрии", "48-11-87"),
        ("как оплатить коммуналку?", "кабінет постачальника"),
        ("хто виконує обов'язки мера?", "Галина Степанівна Шиманська"),
    ],
)
def test_extracts_high_value_curated_civic_facts(question: str, required: str) -> None:
    answer = extract_trusted_civic_answer(
        question,
        [
            (
                "Контакти Житомирської міської ради: телефон (0412) 48-12-32.",
                "https://zt-rada.gov.ua/?departments=86",
            ),
            (
                "Частину цифрових послуг можна також отримати без відвідування ЦНАП через "
                "застосунок «Дія». Загальні контакти: майдан ім. С. П. Корольова, 4/2; "
                "телефон (0412) 48-11-87.",
                "manual-curated",
            ),
            (
                "Міська рада Житомира: адреса майдан ім. С. П. Корольова, 4/2; "
                "телефон (0412) 48-11-87.",
                "manual-curated",
            ),
            (
                "Де зареєструвати ФОП у Житомирі: вул. Бориса Лятошинського, 15-Б; "
                "телефон (0412) 42-01-82; кабінет постачальника або банківський застосунок.",
                "manual-curated",
            ),
            (
                "Як оплатити комунальні послуги: через кабінет постачальника, банківський "
                "застосунок або платіжний сервіс за реквізитами з рахунку.",
                "manual-curated",
            ),
            (
                "Мер Житомира наразі офіційно не обраний. Обов'язки міського голови виконує "
                "секретар міської ради Галина Степанівна Шиманська.",
                "manual-curated",
            ),
        ],
    )
    assert answer is not None
    assert required in answer


def test_city_contact_extraction_prefers_the_dedicated_fact_over_cnap_tail() -> None:
    answer = extract_trusted_civic_answer(
        "дай адрес мэрии",
        [
            (
                "Частину цифрових послуг можна також отримати без відвідування ЦНАП через "
                "застосунок «Дія». Загальні контакти: майдан ім. С. П. Корольова, 4/2; "
                "телефон (0412) 48-11-87.",
                "manual-curated",
            ),
            (
                "Контакти Житомирської міської ради: адреса — майдан ім. С. П. Корольова, 4/2. "
                "Телефон: (0412) 48-11-87.",
                "manual-curated",
            ),
        ],
    )
    assert answer is not None
    assert "Частину цифрових послуг" not in answer


def test_fop_extraction_prefers_curated_fact_over_short_official_chunk() -> None:
    answer = extract_trusted_civic_answer(
        "де зареєструвати ФОП?",
        [
            (
                "1 Місцезнаходження Відділ державної реєстрації ФОП Адреса: "
                "вул. Бориса Лятошинського, 15-Б.",
                "https://zt-rada.gov.ua/?pages=12521",
            ),
            (
                "Де зареєструвати ФОП у Житомирі: вул. Бориса Лятошинського, 15-Б; "
                "телефон (0412) 42-01-82; онлайн через «е-Підприємець» у «Дії».",
                "manual-curated",
            ),
        ],
    )
    assert answer is not None
    assert "42-01-82" in answer


def test_title_sources_are_limited_to_official_or_curated_facts() -> None:
    assert is_trusted_title_source("manual-curated")
    assert is_trusted_title_source("https://zt-rada.gov.ua/page")
    assert not is_trusted_title_source("https://t.me/zhtmr/27699")


def test_normalizes_russian_cnap_location_query() -> None:
    assert normalize_civic_information_query("где находится ЦНАП?") == (
        "Центр надання адміністративних послуг Житомирської міської ради"
    )


def test_normalizes_ukrainian_cnap_location_query_to_subject_anchor() -> None:
    assert normalize_civic_information_query("Де ЦНАП у Житомирі?") == (
        "Центр надання адміністративних послуг Житомирської міської ради"
    )


def test_normalizes_numbered_transport_query_to_route_anchor() -> None:
    assert normalize_civic_information_query("Який маршрут тролейбуса №15А?") == "тролейбус 15а"


def test_recognizes_and_normalizes_city_council_queries() -> None:
    assert is_civic_information_query("Де міська рада Житомира?") is True
    assert (
        normalize_civic_information_query("где находится горсовет Житомира")
        == "Контакти"
    )


def test_normalizes_common_resident_service_queries_to_official_page_vocabulary() -> None:
    assert normalize_civic_information_query("Як подати звернення і де взяти зразок заяви?") == (
        "Зразки заяв та інформаційних запитів"
    )
    assert normalize_civic_information_query("Де карта укриттів?") == (
        "Інтерактивна карта укриттів"
    )
    assert normalize_civic_information_query("Як записати дитину в садок?") == (
        "Електронна реєстрація в заклади дошкільної та загальної середньої освіти"
    )
    assert normalize_civic_information_query("Куди звертатися ветерану?") == (
        "Телефонна ветеранська лінія"
    )
    assert normalize_civic_information_query("Де подивитися тарифи?") == (
        "Тарифна політика Житомира"
    )


def test_civic_service_sources_reject_social_and_place_catalogs() -> None:
    assert is_trusted_civic_source("Де ЦНАП?", "https://zt-rada.gov.ua/?departments=159")
    assert is_trusted_civic_source("Де зробити паспорт?", "https://dmsu.gov.ua/services")
    assert not is_trusted_civic_source("Де ЦНАП?", "https://t.me/zhtmr/27699")
    assert not is_trusted_civic_source("Де ЦНАП?", "openstreetmap")
