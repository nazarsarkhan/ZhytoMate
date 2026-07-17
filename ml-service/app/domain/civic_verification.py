"""Deterministic safety checks for high-risk civic facts.

These checks intentionally cover only relationships that are unsafe to infer from semantic
similarity alone. The first guard prevents a retrieved deputy-mayor directory entry from being
presented as the mayor of Zhytomyr.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

from app.domain.civic_glossary import glossary_retrieval_query, is_glossary_civic_question


@dataclass(frozen=True)
class CivicVerification:
    blocked: bool
    reason: str | None = None


TITLE_NOT_SUPPORTED_ANSWER = (
    "У наданих джерелах немає підтвердженої інформації про те, хто зараз є мером Житомира."
)

_TRUSTED_TITLE_SOURCE_RE = re.compile(
    r"(?:^manual-curated$|zt-rada\.gov\.ua|zhytomyr\.city|zt\.gov\.ua)",
    re.IGNORECASE,
)


_TITLE_QUERY_RE = re.compile(
    r"\b(мер|мэр|мером|мэром|глава\s+города|кто\s+руководит|"
    r"керує\s+містом|очолює\s+місто|голова\s+міста|голови\s+міста|глава\s+міста|"
    r"міський\s+голова|міського\s+голови|городской\s+голова)\b",
    re.IGNORECASE,
)
_TITLE_VARIANT_RE = re.compile(r"\b(?:мерчик|мэрчик|мерито|мэрито)\b", re.IGNORECASE)
_ACTING_QUERY_RE = re.compile(
    r"\b(?:виконує\s+обов['’]?язки|виконує\s+обовязки|і\.?\s*о\.?\s*мера|"
    r"исполняет\s+обязанности|кто\s+исполняет)\b",
    re.IGNORECASE,
)
UTILITY_PAYMENT_SOURCE = "https://zt-rada.gov.ua/?items=56"
UTILITY_PAYMENT_ANSWER = (
    "Як оплатити комунальні послуги у Житомирі: спосіб залежить від постачальника. "
    "Скористайтеся особистим кабінетом відповідного постачальника, банківським застосунком "
    "або касою/платіжним сервісом за реквізитами з актуальної квитанції. Перевірте назву "
    "постачальника, особовий рахунок і реквізити перед оплатою. Перелік міських "
    "житлово-комунальних сервісів: https://zt-rada.gov.ua/?items=56. "
    "Для консультації: міська довідкова служба 15-80 або гаряча лінія (0412) 481-481."
)
_FOP_QUERY_RE = re.compile(
    r"\b(?:фоп|фізичн\w*[- ]підприєм\w*|физическ\w*[- ]предпринимател\w*|"
    r"підприємець|предпринимател\w*|відкрити\s+бізнес|открыть\s+бизнес)\b",
    re.IGNORECASE,
)
_UTILITY_PAYMENT_QUERY_RE = re.compile(
    r"\b(?:комунал\w*|коммунал\w*|квартплат\w*|рахунк\w*|квитанц\w*)\b.*"
    r"\b(?:оплат\w*|заплат\w*|плат\w*)\b|\b(?:оплат\w*|заплат\w*|плат\w*)\b.*"
    r"\b(?:комунал\w*|коммунал\w*|квартплат\w*|рахунк\w*|квитанц\w*)\b",
    re.IGNORECASE,
)
_CITY_CONTACT_QUERY_RE = re.compile(
    r"\b(?:мері\w*|мэр\w*|горсовет\w*|міськ\w*\s+рад\w*|міської\s+ради|"
    r"городск\w*\s+администрац\w*)\b.*"
    r"\b(?:адрес\w*|телефон\w*|номер\w*|контакт\w*)\b|\b(?:адрес\w*|телефон\w*|"
    r"номер\w*|контакт\w*)\b.*\b(?:мері\w*|мэр\w*|горсовет\w*|міськ\w*\s+рад\w*)\b",
    re.IGNORECASE,
)
_CIVIC_INFORMATION_RE = re.compile(
    r"\b(?:паспорт\w*|суд\w*|цнап\w*|прозор\w*|вод\w*|кафе\w*|"
    r"ресторан\w*|їст\w*|по[їі]ст\w*|поест\w*|есть|аптек\w*|лікар\w*|лікарн\w*|"
    r"полікл\w*|транспорт\w*|автобус\w*|тролейбус\w*|вулиц\w*|"
    r"адрес\w*|документ\w*|смітт\w*|субсид\w*|опал\w*|міськ\w*\s+рад\w*|"
    r"горсовет\w*|мэр\w*ию|мери\w*|звернен\w*|заяв\w*|укрит\w*|сховищ\w*|"
    r"ветеран\w*|департамент\w*|посадов\w*|комунальн\w*\s+майн\w*|"
    r"земельн\w*\s+ресурс\w*|тариф\w*)\b",
    re.IGNORECASE,
)
_MAYOR_CONTEXT_RE = re.compile(
    r"(?:\b(?:мер|мэр)\b|міський\s+голова|міського\s+голови|городской\s+голова)",
    re.IGNORECASE,
)
_DEPUTY_RE = re.compile(
    r"\b(заступник|заступники|заместитель|заместители|deputy|assistant)\b",
    re.IGNORECASE,
)
_DIRECT_TITLE_RE = re.compile(
    r"(?:мером|мэром|міський\s+голова|городской\s+голова)\s+"
    r"[^.!?\n]{0,80}(?:є|—|-)\s+[^.!?\n]{2,}",
    re.IGNORECASE,
)
_TITLE_STATUS_RE = re.compile(
    r"\b(?:мер|мэр)\b(?:\s*\([^)]{0,60}\))?[^.!?\n]{0,120}"
    r"\b(?:не\s+обран(?:ий|а|о)?|склав\s+повноваження|не\s+обира(?:вся|ється))\b",
    re.IGNORECASE,
)

_NO_INFO_ANSWER_PATTERNS = (
    re.compile(
        r"\b(?:інформац\w*|информац\w*|дан\w*|відом\w*|сведен\w*)\b"
        r".{0,120}\b(?:немає|нема|нет|відсутн\w*)\b",
        re.IGNORECASE | re.DOTALL,
    ),
    re.compile(
        r"\b(?:немає|нема|нет)\b.{0,120}\b"
        r"(?:інформац\w*|информац\w*|дан\w*|відом\w*|сведен\w*)\b",
        re.IGNORECASE | re.DOTALL,
    ),
    re.compile(
        r"\bне\s+(?:маю|имею)\b.{0,120}\b"
        r"(?:інформац\w*|информац\w*|дан\w*|відом\w*|сведен\w*)\b",
        re.IGNORECASE | re.DOTALL,
    ),
    re.compile(
        r"\b(?:інформац\w*|информац\w*)\b.{0,120}\b"
        r"не\s+(?:вдалося|удалось)\b",
        re.IGNORECASE | re.DOTALL,
    ),
)


def is_civic_title_query(question: str) -> bool:
    """Return whether a query asks for a civic office-holder/title fact."""
    return bool(
        _TITLE_QUERY_RE.search(question)
        or _TITLE_VARIANT_RE.search(question)
        or _ACTING_QUERY_RE.search(question)
    )


def is_trusted_title_source(source: str) -> bool:
    """Only official city sources or curated civic facts may support office-holder answers."""
    return bool(_TRUSTED_TITLE_SOURCE_RE.search(source.strip()))


_TRUSTED_CIVIC_SOURCE_RE = re.compile(
    r"(?:^manual-curated$|zt-rada\.gov\.ua|\.gov\.ua(?:/|$)|zhytomyr\.city|zt\.gov\.ua|cnap)",
    re.IGNORECASE,
)


def is_trusted_civic_source(question: str, source: str) -> bool:
    """Return whether a source is acceptable evidence for a civic-information question."""
    if is_civic_title_query(question):
        return is_trusted_title_source(source)
    return bool(_TRUSTED_CIVIC_SOURCE_RE.search(source.strip()))


def is_civic_information_query(question: str) -> bool:
    """Recognize factual city-service questions before an LLM small-talk classifier can suppress
    retrieval. This is deliberately a narrow topic allowlist, not a general language classifier.
    """
    return bool(
        is_civic_title_query(question)
        or _CIVIC_INFORMATION_RE.search(question)
        or is_glossary_civic_question(question)
        or _FOP_QUERY_RE.search(question)
        or _UTILITY_PAYMENT_QUERY_RE.search(question)
        or _CITY_CONTACT_QUERY_RE.search(question)
    )


def normalize_civic_information_query(question: str) -> str:
    """Canonicalize short city-service questions for stable hybrid retrieval."""
    lowered = question.lower()
    if lowered.strip() == "цнап":
        return "ЦНАП"
    if _ACTING_QUERY_RE.search(lowered):
        return "Хто виконує обов'язки міського голови Житомира?"
    if _FOP_QUERY_RE.search(lowered):
        return "Де зареєструвати ФОП у Житомирі?"
    if _UTILITY_PAYMENT_QUERY_RE.search(lowered):
        return "Як оплатити комунальні послуги в Житомирі?"
    if _CITY_CONTACT_QUERY_RE.search(lowered):
        return "Контакти Житомирської міської ради адреса телефони"
    route_match = re.search(
        r"\b(?:маршрут\w*|маршрутка\w*|тролейбус\w*|автобус\w*)[^0-9]{0,40}(\d+[а-яa-z]?)\b",
        lowered,
        re.IGNORECASE,
    )
    if route_match:
        return f"тролейбус {route_match.group(1)}"
    if re.search(r"\b(?:мерчик|мэрчик|мерито|мэрито)\b", lowered):
        return "Хто мер Житомира?"
    if re.search(r"\b(?:суд|судами|суде)\b", lowered) and re.search(
        r"\b(?:де|где|куда)\b", lowered
    ):
        return "Де суд у Житомирі?"
    if re.search(r"\b(?:звернен\w*|заяв\w*|інформаційн\w*\s+запит\w*)\b", lowered):
        if re.search(r"\b(?:зраз\w*|інформаційн\w*\s+запит\w*)\b", lowered):
            return "Зразки заяв та інформаційних запитів"
        return "Звернення громадян"
    if re.search(r"\bцнап\b", lowered) and re.search(
        r"\b(?:де|где|куда|адрес|розташован\w*|расположен\w*|знаходит\w*)\b", lowered
    ):
        # Keep this retrieval key intentionally short.  Official CNAP facts are split across
        # chunks and use inflected city/address words, so an AND query with the whole question
        # misses the exact fact even though the subject itself is present.
        return "Центр надання адміністративних послуг Житомирської міської ради"
    if re.search(r"\bцнап\b", lowered):
        if re.search(r"\b(?:телефон\w*|номер\w*|контакт\w*)\b", lowered):
            return "Центр надання адміністративних послуг Житомирської міської ради Телефон"
        return "Центр надання адміністративних послуг Житомирської міської ради"
    glossary_query = glossary_retrieval_query(question)
    if glossary_query:
        return glossary_query
    if re.search(r"\b(?:укрит\w*|сховищ\w*)\b", lowered) and re.search(
        r"\b(?:карт\w*|де|знайт\w*|подив\w*|розташован\w*)\b", lowered
    ):
        return "Інтерактивна карта укриттів"
    if re.search(r"\b(?:садоч\w*|садк\w*|садок\w*|дошкільн\w*|школ\w*)\b", lowered) and re.search(
        r"\b(?:реєстр\w*|зареєстр\w*|запис\w*|електрон\w*|оформ\w*)\b", lowered
    ):
        return "Електронна реєстрація в заклади дошкільної та загальної середньої освіти"
    if re.search(r"\bветеран\w*\b", lowered) and re.search(
        r"\b(?:куди|де|телефон\w*|допомог\w*|зверт\w*|управлін\w*)\b", lowered
    ):
        return "Телефонна ветеранська лінія"
    if re.search(r"\b(?:водопостач\w*|водоканал\w*|вода)\b", lowered) and re.search(
        r"\b(?:куди|де|контакт\w*|телефон\w*|проблем\w*|авар\w*)\b", lowered
    ):
        return "Житомирводоканал водопостачання контакти"
    if re.search(r"\b(?:житлово[- ]комунал\w*|жкг)\b", lowered):
        return "Житлово-комунальні питання"
    if re.search(r"\bквартирн\w*\b", lowered) and re.search(
        r"\b(?:облік\w*|черг\w*|житл\w*)\b", lowered
    ):
        return "Квартирний облік Житомир"
    if re.search(r"\b(?:майн\w*|земельн\w*|земл\w*)\b", lowered) and re.search(
        r"\b(?:комунальн\w*|ресурс\w*|ділян\w*|оренд\w*|інформац\w*)\b", lowered
    ):
        return "Комунальне майно та земельні ресурси"
    if re.search(r"\b(?:транспорт\w*|маршрут\w*|тролейбус\w*|автобус\w*)\b", lowered) and re.search(
        r"\b(?:де|подив\w*|схем\w*|графік\w*|маршрут\w*)\b", lowered
    ):
        return "Транспорт"
    if re.search(r"\bтариф\w*\b", lowered):
        return "Тарифна політика Житомира"
    if re.search(r"\bпаспорт\w*\b", lowered) and re.search(
        r"\b(?:де|где|куда)\b", lowered
    ):
        return "Де зробити паспорт у Житомирі?"
    if re.search(r"\b(?:міська\s+рада|горсовет\w*|мэр\w*ия|мэр\w*ию|мери\w*)\b", lowered):
        return "Контакти"
    if re.search(r"\b(?:департамент\w*|посадов\w*|працівник\w*|чиновник\w*)\b", lowered):
        return "Список виконавчих органів Житомирської міської ради"
    return question


def trusted_civic_fallback_answer(question: str) -> tuple[str, str] | None:
    """Return a curated answer when a multilingual typo misses lexical retrieval."""
    if _UTILITY_PAYMENT_QUERY_RE.search(question):
        return UTILITY_PAYMENT_ANSWER, UTILITY_PAYMENT_SOURCE
    return None


def normalize_civic_title_query(question: str) -> str:
    """Canonicalize colloquial/typo title forms before retrieval and translation."""
    had_colloquial_variant = bool(_TITLE_VARIANT_RE.search(question))
    normalized = _TITLE_VARIANT_RE.sub("мер", question)
    if had_colloquial_variant and not re.search(r"житомир", normalized, re.IGNORECASE):
        return "Хто мер?" if re.search(r"\bхто\b", normalized, re.IGNORECASE) else "Кто мер?"
    if _TITLE_QUERY_RE.search(normalized) and re.search(
        r"\b(?:кто|мэр|мэром|мэрчик)\b", normalized, re.IGNORECASE
    ) and not re.search(
        r"\b(?:глава\s+города|голова\s+міста|голова\s+міста|руководит|очолює|керує)\b",
        normalized,
        re.IGNORECASE,
    ):
        # Keep all direct mayor variants (including Russian "кто сейчас мэр") on one stable
        # retrieval anchor. This prevents language/word-order variants from missing the curated
        # official fact and falling through to an ungrounded answer.
        return "Хто мер Житомира?"
    if re.search(
        r"\b(?:глава\s+города|кто\s+руководит|керує\s+містом|очолює\s+місто|"
        r"голова\s+міста|голови\s+міста|глава\s+міста)\b",
        normalized,
        re.IGNORECASE,
    ):
        return "Хто мер Житомира?"
    return normalized


def is_no_information_answer(answer: str) -> bool:
    """Return True when an answer explicitly says the requested information is unavailable.

    Such an answer is intentionally not evidence-backed, even if retrieval surfaced vaguely
    similar pages. Keeping this decision deterministic prevents irrelevant candidate URLs from
    being presented as sources in the UI.
    """
    normalized = " ".join(answer.split())
    return any(pattern.search(normalized) for pattern in _NO_INFO_ANSWER_PATTERNS)


def verify_civic_context(question: str, context_chunks: list[str]) -> CivicVerification:
    """Reject a title answer when retrieval only supports a deputy/assistant title.

    The check is deliberately conservative: it blocks only title questions with retrieved
    context, where every sentence containing a mayor title is also marked as deputy/assistant.
    It does not affect unrelated civic questions or contexts with an explicit top-office claim.
    """
    if not is_civic_title_query(question):
        return CivicVerification(False)

    sentences = [
        sentence.strip()
        for chunk in context_chunks
        for sentence in re.split(r"[.!?\n]+", chunk)
    ]
    title_sentences = [sentence for sentence in sentences if _MAYOR_CONTEXT_RE.search(sentence)]
    supported_sentences = [
        sentence
        for sentence in title_sentences
        if not _DEPUTY_RE.search(sentence)
        and (_DIRECT_TITLE_RE.search(sentence) or _TITLE_STATUS_RE.search(sentence))
    ]
    if not supported_sentences:
        return CivicVerification(True, "title_not_supported")
    return CivicVerification(False)


def extract_trusted_civic_title_answer(
    question: str, context: list[tuple[str, str]]
) -> str | None:
    """Return a deterministic answer for a title fact when trusted evidence states it directly.

    Office-holder facts are too sensitive to leave to free-form paraphrasing: a model can turn a
    deputy mention into a mayor claim or drop a status qualifier. Only official/curated sources
    and sentences already matching the conservative title patterns are eligible.
    """
    if not is_civic_title_query(question):
        return None
    candidates: list[str] = []
    for text, source in context:
        if not is_trusted_title_source(source):
            continue
        for sentence in re.split(r"[.!?\n]+", text):
            sentence = " ".join(sentence.split()).strip()
            if not sentence or _DEPUTY_RE.search(sentence):
                continue
            if _TITLE_STATUS_RE.search(sentence) or _DIRECT_TITLE_RE.search(sentence):
                candidates.append(sentence)
    if not candidates:
        return None
    # Prefer a status sentence: it preserves qualifiers such as “not elected” instead of
    # selecting an older direct-name statement from a neighbouring chunk.
    candidates.sort(key=lambda sentence: 0 if _TITLE_STATUS_RE.search(sentence) else 1)
    return f"За підтвердженою інформацією: {candidates[0]}."


def extract_trusted_civic_answer(
    question: str, context: list[tuple[str, str]]
) -> str | None:
    """Return an exact curated answer for high-value civic facts.

    Addresses, phone numbers, payment routes, and office-holder names must not be paraphrased
    from a mixed retrieval tail. This helper selects a trusted curated chunk by intent and returns
    it verbatim; ordinary civic questions continue through the normal LLM path.
    """
    if not any(is_trusted_civic_source(question, source) for _, source in context):
        return None

    if is_civic_title_query(question) and not _ACTING_QUERY_RE.search(question):
        return extract_trusted_civic_title_answer(question, context)

    markers: tuple[str, ...]
    if _ACTING_QUERY_RE.search(question):
        markers = ("обов'язки міського голови", "обов’язки міського голови", "Шиманська")
    elif _FOP_QUERY_RE.search(question):
        markers = ("ФОП", "підприємця", "Лятошинського")
    elif _UTILITY_PAYMENT_QUERY_RE.search(question):
        markers = ("оплатити комунальні", "кабінет постачальника", "банківський застосунок")
    elif _CITY_CONTACT_QUERY_RE.search(question):
        if re.search(r"\b(?:адрес\w*)\b", question, re.IGNORECASE):
            markers = ("адрес", "Корольова")
        elif re.search(r"\b(?:телефон\w*|номер\w*)\b", question, re.IGNORECASE):
            markers = ("48-11-87",)
        else:
            markers = ("Корольова", "48-11-87")
    else:
        return None

    trusted_context = sorted(
        context,
        key=lambda item: 0 if item[1].strip().casefold() == "manual-curated" else 1,
    )
    require_all_markers = _CITY_CONTACT_QUERY_RE.search(question) is not None
    candidates = [
        (text, source)
        for text, source in trusted_context
        if is_trusted_civic_source(question, source)
        and (
            all(marker.casefold() in text.casefold() for marker in markers)
            if require_all_markers
            else any(marker.casefold() in text.casefold() for marker in markers)
        )
    ]
    candidates.sort(
        key=lambda item: (
            0 if item[1].strip().casefold() == "manual-curated" else 1,
            0
            if "контакти житомирської міської ради" in item[0].casefold()
            else 1,
            len(item[0]),
        )
    )
    for text, _source in candidates:
        return f"За підтвердженою інформацією: {text.strip()}"
    return None
