"""
Purpose:   Flow: valid JSON path; malformed JSON => retry => valid; still-invalid => is_valid:false;
           out-of-range severity/unrecognized category rejected the same way; and the retry-boundary
           check from Phase 2 — a generator-raised API error (the adapter's own retries already
           exhausted) degrades straight to the fallback on a SINGLE call, proving VisionService's
           parse-retry loop is not, and must not become, a second safety net for API-level failures.
Layer:     test
May import:   pytest, app.services.vision_service, tests.fakes.fake_generator, app.schemas/*
Must NOT import:  real google-genai (scripted fake only)
"""
from __future__ import annotations

import json

from app.schemas.vision import VisionResponse
from app.services.vision_service import VisionService
from tests.fakes.fake_generator import FakeGenerator

# Settings is stored but never read by VisionService's own methods (only __init__ keeps a
# reference) — a plain sentinel documents that without pulling in a real Settings instance.
_UNUSED_SETTINGS = object()

_FALLBACK = VisionResponse(is_valid=False, category="other", severity=1, title="", description="")


def _payload(**overrides: object) -> str:
    data = {
        "is_valid": True,
        "category": "pothole",
        "severity": 4,
        "title": "Яма на дорозі",
        "description": "Глибока яма на проїжджій частині.",
    }
    data.update(overrides)
    return json.dumps(data)


def _service(generator: FakeGenerator) -> VisionService:
    return VisionService(generator=generator, settings=_UNUSED_SETTINGS)


async def test_valid_json_on_the_first_attempt_returns_the_response_without_a_retry() -> None:
    generator = FakeGenerator(result=(_payload(), 0))

    result = await _service(generator).analyze(b"fake-bytes", "image/jpeg")

    assert result == VisionResponse(**json.loads(_payload()))
    assert len(generator.analyze_calls) == 1


async def test_malformed_json_on_first_attempt_recovers_via_the_strict_retry() -> None:
    generator = FakeGenerator(results=[("{not valid json", 0), (_payload(), 0)])

    result = await _service(generator).analyze(b"fake-bytes", "image/jpeg")

    assert result == VisionResponse(**json.loads(_payload()))
    assert len(generator.analyze_calls) == 2
    # The retry must actually ask for strict JSON-only output, not repeat the first prompt verbatim.
    first_prompt, retry_prompt = generator.analyze_calls[0][2], generator.analyze_calls[1][2]
    assert "ТІЛЬКИ JSON" in retry_prompt
    assert "ТІЛЬКИ JSON" not in first_prompt


async def test_malformed_json_on_both_attempts_falls_back_to_the_invalid_sentinel() -> None:
    generator = FakeGenerator(results=[("{not valid json", 0), ("still not json", 0)])

    result = await _service(generator).analyze(b"fake-bytes", "image/jpeg")

    assert result == _FALLBACK
    assert len(generator.analyze_calls) == 2


async def test_out_of_range_severity_is_treated_as_invalid_and_retried() -> None:
    bad_severity = _payload(severity=7)
    generator = FakeGenerator(results=[(bad_severity, 0), (_payload(), 0)])

    result = await _service(generator).analyze(b"fake-bytes", "image/jpeg")

    assert result == VisionResponse(**json.loads(_payload()))
    assert len(generator.analyze_calls) == 2


async def test_out_of_range_severity_on_both_attempts_falls_back() -> None:
    generator = FakeGenerator(results=[(_payload(severity=0), 0), (_payload(severity=9), 0)])

    result = await _service(generator).analyze(b"fake-bytes", "image/jpeg")

    assert result == _FALLBACK
    assert len(generator.analyze_calls) == 2


async def test_unrecognized_category_is_treated_as_invalid_and_retried() -> None:
    bad_category = _payload(category="alien_invasion")
    generator = FakeGenerator(results=[(bad_category, 0), (_payload(), 0)])

    result = await _service(generator).analyze(b"fake-bytes", "image/jpeg")

    assert result == VisionResponse(**json.loads(_payload()))
    assert len(generator.analyze_calls) == 2


async def test_transient_api_error_on_first_attempt_goes_straight_to_fallback_with_one_call() -> (
    None
):
    """The retry-boundary check: OpenAILLMClient (the real VisionGenerator adapter) already retries
    transient API errors internally before ever raising (tests/unit/test_llm_client.py). If
    analyze_image() itself raises here, that means the adapter's own retries were already exhausted
    — VisionService's parse-retry loop must NOT treat that as a second chance to call the LLM again;
    the whole analyze() call degrades to the fallback on exactly ONE generator call, not two. This
    is what proves the boundary is understood, not duplicated and not missing.
    """
    generator = FakeGenerator(error=RuntimeError("simulated exhausted adapter retries"))

    result = await _service(generator).analyze(b"fake-bytes", "image/jpeg")

    assert result == _FALLBACK
    assert len(generator.analyze_calls) == 1
