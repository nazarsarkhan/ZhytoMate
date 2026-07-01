"""
Purpose:   Unit: VisionService._parse_and_validate (enum/severity guard, None on any error) and
           VisionRequest validation (mime allowlist, decoded-size cap, base64 sanity). Constructs
           VisionService with placeholder deps — no async calls, no real OpenAI.
Layer:     test
May import:   pytest, app.services.vision_service, app.schemas.vision, stdlib
Must NOT import:  app.components, asyncpg, openai (pure/fast unit test — vision_service defers the SDK import)
"""
from __future__ import annotations

import base64

import pytest
from pydantic import ValidationError

from app.schemas.vision import VisionRequest, VisionResponse
from app.services.vision_service import VisionService

_VALID_B64 = base64.b64encode(b"\xff\xd8\xff\xe0\x00\x10JFIF fake jpeg payload").decode()


def _service() -> VisionService:
    # __init__ only stores the deps; _parse_and_validate never touches them.
    return VisionService(openai_client=object(), settings=object())


def _payload(**overrides: object) -> str:
    import json

    data = {
        "is_valid": True,
        "category": "pothole",
        "severity": 4,
        "title": "Яма на дорозі",
        "description": "Глибока яма на проїжджій частині.",
    }
    data.update(overrides)
    return json.dumps(data)


def test_parse_valid_json_returns_response() -> None:
    result = _service()._parse_and_validate(_payload())
    assert isinstance(result, VisionResponse)
    assert result.category == "pothole" and result.severity == 4 and result.is_valid is True


def test_parse_category_not_in_enum_returns_none() -> None:
    assert _service()._parse_and_validate(_payload(category="alien_invasion")) is None


def test_parse_severity_zero_returns_none() -> None:
    assert _service()._parse_and_validate(_payload(severity=0)) is None


def test_parse_severity_six_returns_none() -> None:
    assert _service()._parse_and_validate(_payload(severity=6)) is None


def test_parse_malformed_json_returns_none() -> None:
    assert _service()._parse_and_validate("{not valid json") is None


def test_request_valid_jpeg() -> None:
    req = VisionRequest(image_base64=_VALID_B64, mime_type="image/jpeg")
    assert req.decode_image() == base64.b64decode(_VALID_B64)


def test_request_invalid_mime() -> None:
    with pytest.raises(ValidationError):
        VisionRequest(image_base64=_VALID_B64, mime_type="image/gif")


def test_request_too_large() -> None:
    oversized = base64.b64encode(b"x" * (4 * 1024 * 1024 + 1)).decode()
    with pytest.raises(ValidationError):
        VisionRequest(image_base64=oversized, mime_type="image/png")


def test_request_invalid_base64() -> None:
    with pytest.raises(ValidationError):
        VisionRequest(image_base64="!!! not base64 !!!", mime_type="image/png")
