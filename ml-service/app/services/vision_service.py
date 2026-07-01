"""
Purpose:   Vision analysis orchestration (§3.3, §4.3): OpenAI gpt-4o-mini vision (json_object) ->
           validate -> one strict-prompt retry -> is_valid:false fallback. Never raises; always
           returns a VisionResponse. The OpenAI client is injected and used via self._client, so no
           SDK import is needed at module load — this module stays importable (and unit-testable)
           with only pydantic + stdlib, mirroring the lazy pattern in app.errors / app.deps.
Layer:     service
May import:   domain/vision_prompts, schemas/vision, config (typing), openai (typing only), app.metrics (lazy)
Must NOT import:  other services/*, api/*, FastAPI/Starlette, asyncpg
"""
from __future__ import annotations

import asyncio
import base64
import json
import logging
from typing import TYPE_CHECKING

from app.domain.vision_prompts import VISION_SYSTEM_PROMPT
from app.schemas.vision import ALLOWED_CATEGORIES, VisionResponse

if TYPE_CHECKING:
    from openai import AsyncOpenAI

    from app.config import Settings

logger = logging.getLogger(__name__)

_VISION_TIMEOUT_S = 12.0
_VISION_TEMPERATURE = 0.1
_MAX_OUTPUT_TOKENS = 512
_STRICT_SUFFIX = "Поверни ТІЛЬКИ JSON об'єкт, без пояснень."

# Shared immutable fallback (§3.3): an unparseable/invalid result becomes a benign "not a problem".
_FALLBACK = VisionResponse(is_valid=False, category="other", severity=1, title="", description="")


class VisionService:
    def __init__(self, openai_client: "AsyncOpenAI", settings: "Settings") -> None:
        self._client = openai_client
        self._settings = settings

    async def analyze(self, image_bytes: bytes, mime_type: str) -> VisionResponse:
        """Generate -> validate -> one strict-prompt retry -> fallback. Never raises (§4.3)."""
        from app.metrics import llm_calls

        result: VisionResponse | None = None
        try:
            raw = await self._call_llm(image_bytes, mime_type, strict=False)
            result = self._parse_and_validate(raw)
            if result is None:
                raw = await self._call_llm(image_bytes, mime_type, strict=True)
                result = self._parse_and_validate(raw)
        except Exception as exc:  # noqa: BLE001 — the LLM is the unreliable hop; degrade, never raise
            logger.warning("vision_llm_error err=%s", type(exc).__name__)

        if result is None:
            logger.warning("vision_fallback")
            llm_calls.labels(route="vision", outcome="fallback").inc()
            return _FALLBACK
        llm_calls.labels(route="vision", outcome="ok").inc()
        return result

    async def _call_llm(self, image_bytes: bytes, mime_type: str, strict: bool = False) -> str:
        """gpt-4o-mini vision call (json_object, 12s timeout). The expected JSON shape is described
        inline in the prompt — OpenAI's json_object mode guarantees valid JSON syntax only, not
        field/enum compliance, so _parse_and_validate does the real enforcement. Raises on API
        error/timeout -> analyze handles it."""
        prompt = VISION_SYSTEM_PROMPT if not strict else f"{VISION_SYSTEM_PROMPT}\n\n{_STRICT_SUFFIX}"
        b64 = base64.b64encode(image_bytes).decode()
        response = await asyncio.wait_for(
            self._client.chat.completions.create(
                model=self._settings.llm_model,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {"url": f"data:{mime_type};base64,{b64}"},
                            },
                        ],
                    }
                ],
                response_format={"type": "json_object"},
                temperature=_VISION_TEMPERATURE,
                max_tokens=_MAX_OUTPUT_TOKENS,
            ),
            timeout=_VISION_TIMEOUT_S,
        )
        return response.choices[0].message.content or ""

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
