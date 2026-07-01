"""
Purpose:   Vision analysis orchestration (§3.3, §4.3): generate (via the VisionGenerator port,
           json_object) -> validate -> one strict-prompt retry -> is_valid:false fallback. Never
           raises; always returns a VisionResponse. The generator is injected as a protocols.
           VisionGenerator, so no OpenAI SDK reference — not even for typing — is needed at module
           load; this module stays importable (and unit-testable) with only pydantic + stdlib,
           mirroring the lazy pattern in app.errors / app.deps.
Layer:     service
May import:   domain/vision_prompts, schemas/vision, app.protocols (VisionGenerator port), config
              (typing), app.metrics (lazy), structlog
Must NOT import:  other services/*, api/*, FastAPI/Starlette, asyncpg, openai
"""
from __future__ import annotations

import json
from typing import TYPE_CHECKING

import structlog

from app.domain.vision_prompts import VISION_SYSTEM_PROMPT
from app.schemas.vision import ALLOWED_CATEGORIES, VisionResponse

if TYPE_CHECKING:
    from app.config import Settings
    from app.protocols import VisionGenerator

logger = structlog.get_logger(__name__)

_VISION_TIMEOUT_S = 12.0
_VISION_TEMPERATURE = 0.1
_MAX_OUTPUT_TOKENS = 512
_STRICT_SUFFIX = "Поверни ТІЛЬКИ JSON об'єкт, без пояснень."

# Shared immutable fallback (§3.3): an unparseable/invalid result becomes a benign "not a problem".
_FALLBACK = VisionResponse(is_valid=False, category="other", severity=1, title="", description="")


class VisionService:
    def __init__(self, generator: "VisionGenerator", settings: "Settings") -> None:
        self._generator = generator
        self._settings = settings

    async def analyze(self, image_bytes: bytes, mime_type: str) -> VisionResponse:
        """Generate -> validate -> one strict-prompt retry -> fallback. Never raises (§4.3)."""
        from app.metrics import llm_calls

        result: VisionResponse | None = None
        retries = 0
        try:
            raw, retries = await self._call_llm(image_bytes, mime_type, strict=False)
            result = self._parse_and_validate(raw)
            if result is None:
                raw, retries = await self._call_llm(image_bytes, mime_type, strict=True)
                result = self._parse_and_validate(raw)
        except Exception as exc:  # noqa: BLE001 — the LLM is the unreliable hop; degrade, never raise
            logger.warning("vision_llm_error", err=type(exc).__name__)

        if result is None:
            logger.warning("vision_fallback", llm_retries=retries)
            llm_calls.labels(route="vision", outcome="fallback").inc()
            return _FALLBACK
        llm_calls.labels(route="vision", outcome="ok").inc()
        return result

    async def _call_llm(
        self, image_bytes: bytes, mime_type: str, strict: bool = False
    ) -> tuple[str, int]:
        """Vision call via the port (json_object, 12s per-attempt timeout, transient errors retried
        by the adapter). The expected JSON shape is described inline in the prompt — json_object
        mode guarantees valid JSON syntax only, not field/enum compliance, so _parse_and_validate
        does the real enforcement. Raises once the adapter's retries are exhausted -> analyze
        handles it. Returns (raw_text, retry_count)."""
        prompt = VISION_SYSTEM_PROMPT if not strict else f"{VISION_SYSTEM_PROMPT}\n\n{_STRICT_SUFFIX}"
        return await self._generator.analyze_image(
            image_bytes,
            mime_type,
            prompt,
            temperature=_VISION_TEMPERATURE,
            max_tokens=_MAX_OUTPUT_TOKENS,
            timeout_s=_VISION_TIMEOUT_S,
        )

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
