"""Deterministic safety checks for high-risk civic facts.

These checks intentionally cover only relationships that are unsafe to infer from semantic
similarity alone. The first guard prevents a retrieved deputy-mayor directory entry from being
presented as the mayor of Zhytomyr.
"""
from __future__ import annotations

import re
from dataclasses import dataclass


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
_CIVIC_INFORMATION_RE = re.compile(
    r"\b(?:паспорт\w*|суд\w*|цнап\w*|прозор\w*|вод\w*|кафе\w*|"
    r"ресторан\w*|їст\w*|по[їі]ст\w*|поест\w*|есть|аптек\w*|лікар\w*|лікарн\w*|"
    r"полікл\w*|транспорт\w*|автобус\w*|тролейбус\w*|вулиц\w*|"
    r"адрес\w*|документ\w*|смітт\w*|субсид\w*|опал\w*|міськ\w*\s+рад\w*|"
    r"горсовет\w*|мэр\w*ию|мери\w*)\b",
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
    return bool(_TITLE_QUERY_RE.search(question) or _TITLE_VARIANT_RE.search(question))


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
    return is_civic_title_query(question) or bool(_CIVIC_INFORMATION_RE.search(question))


def normalize_civic_information_query(question: str) -> str:
    """Canonicalize very short service-location questions for stable lexical retrieval."""
    lowered = question.lower()
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
    if re.search(r"\bцнап\b", lowered) and re.search(
        r"\b(?:де|где|куда|адрес|розташован\w*|расположен\w*|знаходит\w*)\b", lowered
    ):
        # Keep this retrieval key intentionally short.  Official CNAP facts are split across
        # chunks and use inflected city/address words, so an AND query with the whole question
        # misses the exact fact even though the subject itself is present.
        return "ЦНАП"
    if re.search(r"\bпаспорт\w*\b", lowered) and re.search(
        r"\b(?:де|где|куда)\b", lowered
    ):
        return "Де зробити паспорт у Житомирі?"
    if re.search(r"\b(?:міська\s+рада|горсовет\w*|мэр\w*ия|мэр\w*ию|мери\w*)\b", lowered):
        return "Міська рада Житомира адреса контакти"
    return question


def normalize_civic_title_query(question: str) -> str:
    """Canonicalize colloquial/typo title forms before retrieval and translation."""
    had_colloquial_variant = bool(_TITLE_VARIANT_RE.search(question))
    normalized = _TITLE_VARIANT_RE.sub("мер", question)
    if had_colloquial_variant and not re.search(r"житомир", normalized, re.IGNORECASE):
        return "Хто мер?" if re.search(r"\bхто\b", normalized, re.IGNORECASE) else "Кто мер?"
    if _TITLE_QUERY_RE.search(normalized):
        # Keep all direct mayor variants (including Russian "кто сейчас мэр") on one stable
        # retrieval anchor. This prevents language/word-order variants from missing the curated
        # official fact and falling through to an ungrounded answer.
        if re.search(r"\b(?:кто|мэр|мэром|мэрчик)\b", normalized, re.IGNORECASE) and not re.search(
            r"\b(?:глава\s+города|голова\s+міста|голова\s+міста|руководит|очолює|керує)\b",
            normalized,
            re.IGNORECASE,
        ):
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
