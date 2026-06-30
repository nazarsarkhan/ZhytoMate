"""
Purpose:   Vision analysis orchestration (§3.3, §4.3): Gemini structured output -> validate -> one
           strict-prompt retry -> is_valid:false fallback. Never raises; always returns a
           VisionResponse. The google-genai SDK and the Prometheus counter are imported lazily inside
           the methods that use them, so this module stays importable (and unit-testable) with only
           pydantic + stdlib — mirroring the lazy-import pattern in app.errors / app.deps.
Layer:     service
May import:   domain/vision_prompts, schemas/vision, config (typing), google-genai (lazy), app.metrics (lazy)
Must NOT import:  other services/*, api/*, FastAPI/Starlette, asyncpg, sentence-transformers
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import TYPE_CHECKING

from app.domain.vision_prompts import VISION_RESPONSE_SCHEMA, VISION_SYSTEM_PROMPT
from app.schemas.vision import ALLOWED_CATEGORIES, VisionResponse

if TYPE_CHECKING:
    from google import genai

    from app.config import Settings

logger = logging.getLogger(__name__)

_VISION_TIMEOUT_S = 12.0
_VISION_TEMPERATURE = 0.1
_MAX_OUTPUT_TOKENS = 512
_STRICT_SUFFIX = "Поверни ТІЛЬКИ JSON об'єкт, без пояснень."

# Shared immutable fallback (§3.3): an unparseable/invalid result becomes a benign "not a problem".
_FALLBACK = VisionResponse(is_valid=False, category="other", severity=1, title="", description="")


class VisionService:
    def __init__(self, gemini: "genai.Client", settings: "Settings") -> None:
        self._gemini = gemini
        self._settings = settings

    async def analyze(self, image_bytes: bytes, mime_type: str) -> VisionResponse:
        """Generate -> validate -> one strict-prompt retry -> fallback. Never raises (§4.3)."""
        from app.metrics import gemini_calls

        result: VisionResponse | None = None
        try:
            raw = await self._call_gemini(image_bytes, mime_type, strict=False)
            result = self._parse_and_validate(raw)
            if result is None:
                raw = await self._call_gemini(image_bytes, mime_type, strict=True)
                result = self._parse_and_validate(raw)
        except Exception as exc:  # noqa: BLE001 — Gemini is the unreliable hop; degrade, never raise
            logger.warning("vision_gemini_error err=%s", type(exc).__name__)

        if result is None:
            logger.warning("vision_fallback")
            gemini_calls.labels(route="vision", outcome="fallback").inc()
            return _FALLBACK
        gemini_calls.labels(route="vision", outcome="ok").inc()
        return result

    async def _call_gemini(self, image_bytes: bytes, mime_type: str, strict: bool = False) -> str:
        """Structured-output vision call (12s timeout). Raises APIError/TimeoutError -> analyze handles."""
        from google.genai import types

        prompt = VISION_SYSTEM_PROMPT if not strict else f"{VISION_SYSTEM_PROMPT}\n\n{_STRICT_SUFFIX}"
        response = await asyncio.wait_for(
            self._gemini.aio.models.generate_content(
                model=self._settings.gemini_model,
                contents=[
                    types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                    prompt,
                ],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=VISION_RESPONSE_SCHEMA,
                    temperature=_VISION_TEMPERATURE,
                    max_output_tokens=_MAX_OUTPUT_TOKENS,
                ),
            ),
            timeout=_VISION_TIMEOUT_S,
        )
        return response.text

    def _parse_and_validate(self, raw: str) -> VisionResponse | None:
        """Parse JSON -> VisionResponse with a manual category-enum check. Returns None on ANY error."""
        try:
            data = json.loads(raw)
            if not isinstance(data, dict) or data.get("category") not in ALLOWED_CATEGORIES:
                return None
            return VisionResponse(**data)  # severity 1..5 enforced by the model
        except Exception:  # noqa: BLE001 — never raises; None triggers the retry/fallback in analyze
            logger.debug("vision_parse_failed")
            return None
